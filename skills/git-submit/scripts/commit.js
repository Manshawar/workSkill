#!/usr/bin/env node
// commit.js — probe（分类素材）+ commit（本地提交）
// 模型禁止再调 git add/commit/fetch/push；一律走本脚本。
// Usage:
//   node scripts/commit.js probe [--cwd <path>] [--deep-diff]
//   node scripts/commit.js commit -m "<msg>" [--cwd <path>] [--files f1 f2] [--amend] [--dry-run]

'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

const DANGER_PATH_RE =
  /(^|\/)(\.env|\.env\..*|.*\.(key|pem|crt|p12|cer)|id_rsa)($|\/)/i;
const DANGER_NAME_RE = /(secret|password|token|credential)/i;
const MIGRATION_RE = /(migration|schema|\.sql$)/i;
const CI_RE = /(^|\/)(\.github\/workflows\/|\.gitlab-ci\.yml|Jenkinsfile)/;
const JUNK_RE = /(\.log$|\.tmp$|(^|\/)(node_modules|dist|build)\/|\.DS_Store$)/;
const MSG_RE = /^(feat|fix|refactor|style|docs|test|perf|build|ci|chore):\s+\S/;

function parseArgs(raw) {
  const args = {
    command: null,
    cwd: process.cwd(),
    deepDiff: false,
    message: '',
    files: null,
    amend: false,
    dryRun: false,
  };
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '--cwd') args.cwd = path.resolve(raw[++i] || process.cwd());
    else if (a === '--deep-diff') args.deepDiff = true;
    else if (a === '-m' || a === '--message') args.message = raw[++i] || '';
    else if (a === '--files') {
      args.files = [];
      while (raw[i + 1] && !raw[i + 1].startsWith('-')) args.files.push(raw[++i]);
    }
    else if (a === '--amend') args.amend = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (!args.command) args.command = a;
  }
  return args;
}

function git(cwd, gitArgs, allowFail = false) {
  try {
    return execFileSync('git', gitArgs, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 12 * 1024 * 1024,
    }).trimEnd();
  } catch (e) {
    if (allowFail) return '';
    const msg = (e.stderr && String(e.stderr).trim()) || e.message;
    const err = new Error(msg);
    err.status = e.status;
    throw err;
  }
}

function emit(obj) {
  // 紧凑 JSON，无空行/缩进
  console.log(JSON.stringify(obj));
}

function fail(obj, code = 1) {
  emit({ ok: false, ...obj });
  process.exit(code);
}

function repoRoot(cwd) {
  try {
    if (git(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return null;
  } catch {
    return null;
  }
  return git(cwd, ['rev-parse', '--show-toplevel'], true) || cwd;
}

function collect(cwd) {
  const root = repoRoot(cwd);
  if (!root) return null;

  const branch = git(root, ['branch', '--show-current'], true) || null;
  const short = git(root, ['status', '--short'], true) || '';
  const lines = short.split('\n').filter(Boolean);

  const conflict = [];
  const tracked = [];
  const untracked = [];
  for (const line of lines) {
    const code = line.slice(0, 2);
    const f = line.slice(3);
    if (code.includes('U') || /^(AA|DD)$/.test(code)) conflict.push(f);
    if (code === '??') untracked.push(f);
    else tracked.push(f);
  }

  const add = untracked.filter((f) => !JUNK_RE.test(f));
  const skip = untracked.filter((f) => JUNK_RE.test(f));
  const clean = lines.length === 0;

  let stat = git(root, ['diff', '--stat', 'HEAD'], true)
    || git(root, ['diff', '--stat'], true)
    || '';
  // 压掉多余空行
  stat = stat.replace(/\n{2,}/g, '\n').trim().slice(0, 2500);

  const nameOnly = [
    ...(git(root, ['diff', '--name-only', 'HEAD'], true) || '').split('\n'),
    ...(git(root, ['diff', '--cached', '--name-only'], true) || '').split('\n'),
    ...tracked,
    ...untracked,
  ].map((s) => s.trim()).filter(Boolean);
  const paths = [...new Set(nameOnly)];

  const numstat = git(root, ['diff', '--numstat', 'HEAD'], true)
    || git(root, ['diff', '--numstat'], true)
    || '';

  const danger = [];
  if (!clean) {
    for (const f of paths) {
      if (DANGER_PATH_RE.test(f) || DANGER_NAME_RE.test(f)) danger.push({ t: 'secret', f });
      else if (/\.(crt|p12|cer)$/i.test(f)) danger.push({ t: 'cert', f });
      else if (MIGRATION_RE.test(f)) danger.push({ t: 'migration', f });
      else if (CI_RE.test(f)) danger.push({ t: 'ci', f });
    }
    let delLines = 0;
    let delFiles = 0;
    for (const line of numstat.split('\n').filter(Boolean)) {
      const [a, d] = line.split(/\t/);
      const addN = a === '-' ? 0 : parseInt(a, 10) || 0;
      const delN = d === '-' ? 0 : parseInt(d, 10) || 0;
      delLines += delN;
      if (delN > 0 && addN === 0) delFiles += 1;
    }
    if (delLines > 200 || delFiles >= 3) {
      danger.push({ t: 'mass_delete', f: '*', d: `${delLines}L/${delFiles}f` });
    }
  }

  const types = clean
    ? []
    : (git(root, ['log', '-5', '--format=%s'], true) || '').split('\n').filter(Boolean);

  // 默认纳入：已改 tracked + 非垃圾 untracked
  const defaultFiles = [...new Set([...tracked, ...add])];

  return {
    root,
    branch,
    clean,
    n: paths.length,
    paths,
    add,
    skip,
    conflict,
    defaultFiles,
    stat,
    types,
    danger,
  };
}

function cmdProbe(args) {
  const data = collect(args.cwd);
  if (!data) fail({ err: 'not_git' });

  const out = {
    ok: true,
    root: data.root,
    branch: data.branch,
    clean: data.clean,
    n: data.n,
    paths: data.paths,
    add: data.add,
    skip: data.skip,
    conflict: data.conflict,
    files: data.defaultFiles,
    stat: data.stat,
    types: data.types,
    danger: data.danger,
  };

  if (data.conflict.length) out.gate = 'conflict';
  else if (data.danger.some((h) => h.t === 'secret' || h.t === 'cert')) out.gate = 'danger';
  else if (data.danger.length) out.gate = 'danger_soft';

  if (args.deepDiff && !data.clean) {
    let patch = git(data.root, ['diff', 'HEAD'], true) || git(data.root, ['diff'], true) || '';
    patch = patch.replace(/\n{3,}/g, '\n\n');
    out.patch = patch.length > 12000 ? `${patch.slice(0, 12000)}\n…[truncated]` : patch;
  }

  emit(out);
}

function cmdCommit(args) {
  const msg = (args.message || '').trim();
  if (!msg) fail({ err: 'need_-m', usage: 'commit -m "feat: 描述"' });
  if (!MSG_RE.test(msg)) {
    fail({ err: 'bad_message', hint: '需匹配 type: 中文描述', message: msg });
  }

  const data = collect(args.cwd);
  if (!data) fail({ err: 'not_git' });
  if (data.conflict.length) fail({ err: 'conflict', conflict: data.conflict });
  if (data.clean && !args.amend) fail({ err: 'clean' });

  const hardDanger = data.danger.filter((h) => h.t === 'secret' || h.t === 'cert');
  // 密钥类：脚本拒绝提交（模型须先让用户确认并改文件列表，或用户自行处理）
  if (hardDanger.length && !(args.files && args.files.length)) {
    fail({ err: 'danger', danger: hardDanger });
  }

  const files = (args.files && args.files.length) ? args.files : data.defaultFiles;
  if (!args.amend && files.length === 0) fail({ err: 'no_files' });

  if (args.dryRun) {
    emit({ ok: true, dryRun: true, message: msg, files, amend: args.amend, root: data.root });
    return;
  }

  try {
    if (!args.amend) {
      git(data.root, ['add', '--', ...files]);
      git(data.root, ['commit', '-m', msg]);
    } else {
      if (files.length) git(data.root, ['add', '--', ...files]);
      // 保留原 body/trailer；只换 subject 时用 -m 会丢 Change-Id，故无新文件时 --no-edit
      if (files.length) git(data.root, ['commit', '--amend', '-m', msg]);
      else git(data.root, ['commit', '--amend', '--no-edit']);
    }
  } catch (e) {
    fail({ err: 'git_failed', detail: e.message });
  }

  const subject = git(data.root, ['log', '-1', '--format=%s'], true) || msg;
  const hash = git(data.root, ['log', '-1', '--format=%h'], true) || '';
  emit({ ok: true, hash, message: subject, files: args.amend && !files.length ? ['(amend)'] : files, branch: data.branch });
}

const args = parseArgs(process.argv.slice(2));
const cmd = args.command || 'probe';

if (cmd === 'probe') cmdProbe(args);
else if (cmd === 'commit') cmdCommit(args);
else {
  console.error('usage: commit.js probe|commit -m "<msg>" [--files ...] [--amend] [--dry-run] [--cwd <path>]');
  process.exit(1);
}
