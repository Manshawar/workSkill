#!/usr/bin/env node
// git-submit.js — 只读信息采集（禁止 commit/push/rebase）
// Usage:
//   node scripts/git-submit.js probe [--cwd <path>] [--deep-log] [--deep-diff]
//
// 默认一次输出 JSON。模型禁止为 status/log/remote/config 再拆 Bash。
// 不检查 commit-msg hook（子目录开 IDE 易误判）。

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CONFIG_NAME = '.git-submit.json';
const DANGER_PATH_RE =
  /(^|\/)(\.env|\.env\..*|.*\.(key|pem|crt|p12|cer)|id_rsa|id_rsa\.pub)($|\/)/i;
const DANGER_NAME_HINT_RE = /(secret|password|token|credential)/i;
const MIGRATION_RE = /(migration|schema|\.sql$)/i;
const CI_RE = /(^|\/)(\.github\/workflows\/|\.gitlab-ci\.yml|Jenkinsfile)/;
const JUNK_UNTRACKED_RE =
  /(\.log$|\.tmp$|(^|\/)node_modules\/|(^|\/)(dist|build)\/|\.DS_Store$)/;

function parseArgs(raw) {
  const args = { command: null, cwd: process.cwd(), deepLog: false, deepDiff: false };
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '--cwd') args.cwd = path.resolve(raw[++i] || process.cwd());
    else if (a === '--deep-log') args.deepLog = true;
    else if (a === '--deep-diff') args.deepDiff = true;
    else if (!args.command) args.command = a;
    else console.error(`unknown arg: ${a}`);
  }
  return args;
}

function git(cwd, gitArgs, { allowFail = false } = {}) {
  try {
    return execFileSync('git', gitArgs, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    }).trimEnd();
  } catch (e) {
    if (allowFail) return '';
    const err = new Error(e.stderr?.toString?.().trim() || e.message);
    err.code = e.status;
    throw err;
  }
}

function isGitRepo(cwd) {
  try {
    return git(cwd, ['rev-parse', '--is-inside-work-tree']) === 'true';
  } catch {
    return false;
  }
}

function parseStatusShort(text) {
  const lines = text.split('\n').filter(Boolean);
  const entries = [];
  const conflict = [];
  const changed = [];
  const untracked = [];
  for (const line of lines) {
    const code = line.slice(0, 2);
    const file = line.slice(3);
    const entry = { code, path: file };
    entries.push(entry);
    if (/[UA]{2}|DD|DU|UD|AU|UA/.test(code) || code.includes('U')) conflict.push(entry);
    if (code === '??') untracked.push(file);
    else changed.push(file);
  }
  return { entries, conflict, changed, untracked };
}

function classifyUntracked(paths) {
  const include = [];
  const exclude = [];
  for (const p of paths) {
    if (JUNK_UNTRACKED_RE.test(p)) exclude.push(p);
    else include.push(p);
  }
  return { include_default: include, exclude_default: exclude };
}

function readConfig(cwd) {
  const filePath = path.join(cwd, CONFIG_NAME);
  if (!fs.existsSync(filePath)) {
    return { path: filePath, exists: false, raw: null, pushStrategy: null, branch: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const pushStrategy =
      raw.pushStrategy === 'gerrit' || raw.pushStrategy === 'git' ? raw.pushStrategy : null;
    return {
      path: filePath,
      exists: true,
      raw,
      pushStrategy,
      branch: typeof raw.branch === 'string' && raw.branch ? raw.branch : null,
      valid: Boolean(pushStrategy),
    };
  } catch (e) {
    return {
      path: filePath,
      exists: true,
      raw: null,
      pushStrategy: null,
      branch: null,
      valid: false,
      error: e.message,
    };
  }
}

function detectStrategyFromRemotes(remotesText) {
  const lower = remotesText.toLowerCase();
  if (/gerrit|refs\/for|\/review[\.\/:]/.test(lower)) {
    return { pushStrategy: 'gerrit', reason: 'remote 含 gerrit/review/refs/for' };
  }
  if (/github\.com|gitlab\.|gitee\.com|git@github|git@gitlab|git@gitee/.test(lower)) {
    return { pushStrategy: 'git', reason: 'remote 为 github/gitlab/gitee' };
  }
  return { pushStrategy: 'unknown', reason: '无法从 remote 判定' };
}

function scanDanger(cwd, statusEntries, diffStat) {
  const hits = [];
  const seen = new Set();

  function add(type, file, detail) {
    const key = `${type}:${file}:${detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ type, file, detail });
  }

  for (const { path: file } of statusEntries) {
    if (DANGER_PATH_RE.test(file) || DANGER_NAME_HINT_RE.test(file)) {
      add('secret_or_credential', file, '路径/文件名疑似密钥或凭据');
    }
    if (/\.(crt|p12|cer)$/i.test(file)) add('certificate', file, '证书文件');
    if (MIGRATION_RE.test(file)) add('db_migration', file, '疑似迁移/SQL（需人工确认是否破坏性）');
    if (CI_RE.test(file)) add('ci', file, 'CI 配置变更');
  }

  // 大规模删除：从 diff --numstat 估
  const numstat = git(cwd, ['diff', '--numstat', 'HEAD'], { allowFail: true })
    || git(cwd, ['diff', '--numstat', '--cached'], { allowFail: true });
  let deletedFiles = 0;
  let deletedLines = 0;
  for (const line of (numstat || '').split('\n').filter(Boolean)) {
    const [add, del, file] = line.split(/\t/);
    const d = del === '-' ? 0 : parseInt(del, 10) || 0;
    const a = add === '-' ? 0 : parseInt(add, 10) || 0;
    if (d > 0 && a === 0) deletedFiles += 1;
    deletedLines += d;
  }
  if (deletedLines > 200 || deletedFiles >= 3) {
    add(
      'mass_delete',
      '(multiple)',
      `删除约 ${deletedLines} 行 / ${deletedFiles} 个整文件删除迹象`,
    );
  }

  // diff_stat 仅作补充上下文
  if (diffStat && /migration|\.sql/i.test(diffStat)) {
    // 已按路径扫过；此处不重复
  }

  return hits;
}

function amendInfo(cwd, branch, forceDeep) {
  const headBody = git(cwd, ['log', '-1', '--format=%B'], { allowFail: true });
  const hasChangeId = /Change-Id:/i.test(headBody || '');
  let ahead = 0;
  if (branch) {
    const n = git(cwd, ['rev-list', '--count', `origin/${branch}..HEAD`], { allowFail: true });
    ahead = parseInt(n || '0', 10) || 0;
  }
  const allowed = hasChangeId && ahead >= 1;
  return {
    has_change_id: hasChangeId,
    ahead,
    allowed,
    reason: allowed
      ? 'HEAD 含 Change-Id 且尚未进入 origin/<branch>（可 amend 续 Review）'
      : hasChangeId
        ? '有 Change-Id 但 ahead=0（可能已共享），禁止自动 amend'
        : '无 Change-Id，禁止自动 amend（除非用户 --amend）',
    head_subject: git(cwd, ['log', '-1', '--format=%s'], { allowFail: true }) || null,
    // 默认不回传全文 body，避免刷 token；需要时模型再 git log -1
    _deep: forceDeep ? { head_body: headBody } : undefined,
  };
}

function recentLog(cwd, deep) {
  if (!deep) {
    // 轻量：只要 type 样例 + 是否出现过 Change-Id，不回传 20 条 items（省上下文）
    const subjects = git(cwd, ['log', '-8', '--format=%s'], { allowFail: true }) || '';
    const bodies = git(cwd, ['log', '-20', '--format=%b'], { allowFail: true }) || '';
    const type_samples = subjects.split('\n').filter(Boolean);
    return {
      checked: true,
      deep: false,
      any_change_id: /Change-Id:/i.test(bodies),
      type_samples,
    };
  }

  const nullRaw = git(cwd, ['log', '-20', '--format=%h%x00%s%x00%b%x00'], { allowFail: true }) || '';
  const parts = nullRaw.split('\x00');
  const items = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const hash = (parts[i] || '').replace(/^\n+/, '');
    if (!hash) continue;
    const subject = parts[i + 1] || '';
    const body = parts[i + 2] || '';
    items.push({
      hash,
      subject,
      has_change_id: /Change-Id:/i.test(body),
    });
  }
  return {
    checked: true,
    deep: true,
    any_change_id: items.some((i) => i.has_change_id),
    type_samples: items.slice(0, 8).map((i) => i.subject),
    items,
  };
}

function syncInfo(cwd, branch) {
  let ahead = 0;
  let behind = 0;
  if (branch) {
    // 不 fetch；只读本地已有 origin/<branch> 信息（fetch 留给 sync 步）
    const ab = git(
      cwd,
      ['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`],
      { allowFail: true },
    );
    // output: "<behind>\t<ahead>" with --left-right relative to first...second?
    // HEAD...origin/branch with --left-right: left=HEAD only (=ahead), right=origin only (=behind)
    // Actually: git rev-list --left-right --count A...B → "<commits only in A>\t<commits only in B>"
    // HEAD...origin/X → ahead \t behind
    if (ab) {
      const [left, right] = ab.split(/\s+/).map((n) => parseInt(n, 10) || 0);
      ahead = left;
      behind = right;
    }
  }
  return {
    ahead,
    behind,
    needs_sync: behind > 0,
    note: behind > 0
      ? '本地落后远程；有未提交改动时必须先 commit 再 fetch+rebase（禁止 stash）'
      : '本地不落后 origin/<branch>（仍建议 push 前 fetch 确认）',
  };
}

function cmdProbe(args) {
  const cwd = args.cwd;
  const out = {
    ok: true,
    cwd,
    repo_root: null,
    is_git: false,
    clean: false,
    branch: null,
    upstream: null,
    remotes: '',
    sync: null,
    status: null,
    untracked_policy: null,
    diff_stat: '',
    diff_name_only: [],
    recent_log: null,
    config: null,
    push_strategy: null,
    push_strategy_source: null,
    push_strategy_reason: null,
    amend: null,
    danger_hits: [],
    hints: [],
    bash_plan: [],
  };

  if (!isGitRepo(cwd)) {
    out.ok = false;
    out.error = '当前目录不是 git 仓库';
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }
  out.is_git = true;
  out.repo_root = git(cwd, ['rev-parse', '--show-toplevel'], { allowFail: true }) || cwd;

  out.branch = git(cwd, ['branch', '--show-current'], { allowFail: true }) || null;
  out.upstream = git(cwd, ['rev-parse', '--abbrev-ref', '@{upstream}'], { allowFail: true }) || null;
  out.remotes = git(cwd, ['remote', '-v'], { allowFail: true }) || '';

  const statusText = git(cwd, ['status', '--short'], { allowFail: true }) || '';
  const parsed = parseStatusShort(statusText);
  // 精简 status：不回传 entries 全量（与 changed/untracked 重复，浪费上下文）
  out.status = {
    short: statusText,
    conflict: parsed.conflict,
    changed: parsed.changed,
    untracked: parsed.untracked,
    counts: {
      changed: parsed.changed.length,
      untracked: parsed.untracked.length,
      conflict: parsed.conflict.length,
    },
  };
  out.untracked_policy = classifyUntracked(parsed.untracked);
  out.clean = parsed.entries.length === 0;

  if (parsed.conflict.length) {
    out.hints.push('门1: 存在冲突文件，禁止 commit/push，先解决 rebase/merge 冲突');
  }

  out.diff_stat = git(cwd, ['diff', '--stat', 'HEAD'], { allowFail: true })
    || git(cwd, ['diff', '--stat'], { allowFail: true })
    || '';
  const nameOnly = git(cwd, ['diff', '--name-only', 'HEAD'], { allowFail: true })
    || git(cwd, ['diff', '--name-only'], { allowFail: true })
    || '';
  const cachedNames = git(cwd, ['diff', '--cached', '--name-only'], { allowFail: true }) || '';
  out.diff_name_only = [...new Set(
    [...nameOnly.split('\n'), ...cachedNames.split('\n'), ...parsed.changed, ...parsed.untracked]
      .map((s) => s.trim())
      .filter(Boolean),
  )];

  if (args.deepDiff) {
    out.diff_patch = git(cwd, ['diff', 'HEAD'], { allowFail: true }) || git(cwd, ['diff'], { allowFail: true }) || '';
  }

  out.config = readConfig(out.repo_root);
  // 不回传 raw 整份配置
  if (out.config && out.config.raw) delete out.config.raw;

  const remoteGuess = detectStrategyFromRemotes(out.remotes);
  if (out.config.pushStrategy) {
    out.push_strategy = out.config.pushStrategy;
    out.push_strategy_source = 'config';
    out.push_strategy_reason = `.git-submit.json pushStrategy=${out.config.pushStrategy}`;
  } else if (remoteGuess.pushStrategy !== 'unknown') {
    out.push_strategy = remoteGuess.pushStrategy;
    out.push_strategy_source = 'remote';
    out.push_strategy_reason = remoteGuess.reason;
  } else {
    out.push_strategy = 'unknown';
    out.push_strategy_source = 'none';
    out.push_strategy_reason = remoteGuess.reason;
    out.hints.push('门4: push 策略未知，需问用户并写回 .git-submit.json');
  }

  out.sync = syncInfo(cwd, out.branch);

  const maybeGerrit = out.push_strategy === 'gerrit' || out.push_strategy === 'unknown';
  const needLog = args.deepLog || maybeGerrit || !out.clean;
  out.recent_log = needLog
    ? recentLog(cwd, args.deepLog)
    : { checked: false, type_samples: [], skipped: 'clean_or_plain_git' };

  out.amend = amendInfo(cwd, out.branch, false);

  out.danger_hits = out.clean ? [] : scanDanger(cwd, parsed.entries, out.diff_stat);
  if (out.danger_hits.length) {
    out.hints.push('门3: 命中危险文件特征，提交前需用户确认');
  }

  if (out.amend && out.amend._deep === undefined) delete out.amend._deep;

  // 给模型的理想 Bash 预算（有改动时）
  if (!out.clean && !parsed.conflict.length) {
    out.bash_plan = [
      '1) git add + git commit（先提交；禁止先 rebase/stash）',
      '2) git fetch && git rebase origin/<branch>（commit 后工作区干净）',
      out.push_strategy === 'gerrit'
        ? '3) git push refs/for + git push branch（可同一 Bash）'
        : '3) git push origin <branch>',
    ];
    out.hints.push('顺序铁律: 有未提交改动 → 先 commit 再 sync；禁止 stash；禁止 probe 后再 git diff/status/log');
  }

  console.log(JSON.stringify(out, null, 2));
}

const args = parseArgs(process.argv.slice(2));
const command = args.command || 'probe';

switch (command) {
  case 'probe':
    cmdProbe(args);
    break;
  default:
    console.error(`unknown command: ${command}`);
    console.error('available: probe');
    console.error('probe is read-only: no commit / push / rebase / fetch');
    process.exit(1);
}
