#!/usr/bin/env node
// daily-report.js — Unified entry point for daily-report skill
// Replaces: get-memory-dir.sh, save-repo.sh, list-repos.sh, detect-project.sh,
//           collect-commits.sh, gather-commits.sh, copy-to-clipboard.js
// Usage:
//   node scripts/daily-report.js init [--role <角色>] [--auto-copy <bool>]
//   node scripts/daily-report.js gather --repos <json-array> --date YYYY-MM-DD [--author <email>]
//   node scripts/daily-report.js clipboard   (stdin = content to copy)
//   node scripts/daily-report.js save-repo --path <path> [--alias <alias>] [--cwd] [--touch]
//   node scripts/daily-report.js list-repos [--json] [--current]

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ─── Paths ──────────────────────────────────────────────────────────────
const SKILL_DIR = path.resolve(__dirname, '..');
const MEMORY_DIR = path.join(SKILL_DIR, 'memory');
const SETTING_PATH = path.join(MEMORY_DIR, 'setting.json');
const LEGACY_CONFIG = path.join(MEMORY_DIR, 'daily-report-config.json');

// ─── Default setting.json template ──────────────────────────────────────
const DEFAULT_SETTING = {
  role: '',
  auto_copy: null,
  node_available: true,
  git_user_email: '',
  repositories: [],
  role_definitions: {
    '前端': { use_git: true,  soft_work_categories: ['联调', '提测', 'UI 走查', 'code review', '配合后端'] },
    '后端': { use_git: true,  soft_work_categories: ['接口对齐', '性能优化', '排查线上问题', 'code review', '配合前端'] },
    '运维': { use_git: false, soft_work_categories: ['升级', '备份', '监控', '配合客户'] },
    '测试': { use_git: false, soft_work_categories: ['走查', '复现 bug', '配合开发排查', '验收', '回归'] },
    '产品': { use_git: false, soft_work_categories: ['需求评审', '写 PRD', '用户访谈', '走查', '验收'] },
  },
  _hint: 'role: 空 → 弹角色选择;auto_copy: null → 弹"是否启用剪贴板";git_user_email: 顶层共享;repositories: 用 save-repo 管理;role_definitions: 5 角色元数据',
};

// ─── Utility ─────────────────────────────────────────────────────────────
function ensureMemoryDir() {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function readSetting() {
  if (!fs.existsSync(SETTING_PATH)) return null;
  return JSON.parse(fs.readFileSync(SETTING_PATH, 'utf8'));
}

function writeSetting(data) {
  ensureMemoryDir();
  fs.writeFileSync(SETTING_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function tryExec(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch { return ''; }
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

// ─── init subcommand ────────────────────────────────────────────────────
function cmdInit(args) {
  ensureMemoryDir();

  // Migrate legacy config.json → setting.json
  if (fs.existsSync(LEGACY_CONFIG) && !fs.existsSync(SETTING_PATH)) {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_CONFIG, 'utf8'));
    const gitUser = (legacy.repositories || [])
      .map(r => r.git_user || '')
      .filter(Boolean)[0] || '';
    const migrated = {
      role: legacy.role || '',
      auto_copy: legacy.auto_copy ?? null,
      node_available: legacy.node_available ?? true,
      git_user_email: gitUser,
      repositories: (legacy.repositories || []).map(r => ({ ...r, git_user: undefined })),
      role_definitions: legacy.role_definitions || DEFAULT_SETTING.role_definitions,
    };
    // Clean up undefined fields from map
    migrated.repositories = (legacy.repositories || []).map(r => {
      const clean = { path: r.path, alias: r.alias, git_remote: r.git_remote || '', added_at: r.added_at || isoNow(), last_used_at: r.last_used_at || isoNow() };
      return clean;
    });
    writeSetting(migrated);
    fs.unlinkSync(LEGACY_CONFIG);
  }

  // Create setting.json if not exists
  if (!fs.existsSync(SETTING_PATH)) {
    const s = { ...DEFAULT_SETTING };
    if (args.role) s.role = args.role;
    writeSetting(s);
  }

  let setting = readSetting();

  // Write back role if provided
  if (args.role) {
    setting.role = args.role;
    writeSetting(setting);
  }

  // Write back auto_copy if provided
  if (args.autoCopy !== undefined) {
    setting.auto_copy = args.autoCopy === 'true' || args.autoCopy === true;
    writeSetting(setting);
    setting = readSetting();
  }

  // Detect node availability (always true since we're running in node)
  setting.node_available = true;

  // Derive categories from role
  const roleDef = setting.role_definitions?.[setting.role];
  const categories = roleDef ? roleDef.soft_work_categories : [];
  const useGit = roleDef ? roleDef.use_git : false;

  // Output everything as JSON
  const output = {
    memory_dir: MEMORY_DIR,
    setting_path: SETTING_PATH,
    role: setting.role,
    auto_copy: setting.auto_copy,
    node_available: setting.node_available,
    git_user_email: setting.git_user_email,
    repositories: setting.repositories,
    categories,
    use_git: useGit,
  };
  console.log(JSON.stringify(output, null, 2));
}

// ─── gather subcommand ──────────────────────────────────────────────────
function cmdGather(args) {
  if (!args.repos && !args.userRepos) {
    console.error('usage: daily-report.js gather --repos <json-array> [--user-repo <path>...] [--date YYYY-MM-DD] [--author <email>]');
    process.exit(1);
  }

  // 1) 解析输入仓库列表
  let repos = [];
  if (args.repos) {
    try { repos = JSON.parse(args.repos); } catch (e) {
      console.error('❌ --repos JSON 解析失败：', e.message);
      process.exit(1);
    }
  }

  // 2) 必做: 探测 cwd git repo, 合并进 repos 列表 (Step 1 铁律)
  //    即使 --repos 已传, 也要探测 cwd — 用户给的不能替代 cwd
  const setting = readSetting();
  const now = isoNow();
  const cwd = process.cwd();
  const cwdIsGit = !!tryExec(`git -C "${cwd}" rev-parse --git-dir`);

  // 3) 合并策略: 已有 repos + cwd 命中 + 用户 --user-repo, 按 path 去重
  const seen = new Set(repos.map(r => r.path));
  const toAdd = [];

  if (cwdIsGit && !seen.has(cwd)) {
    const alias = path.basename(cwd);
    const gitRemote = tryExec(`git -C "${cwd}" config --get remote.origin.url`);
    toAdd.push({ path: cwd, alias, display_name: '', git_remote: gitRemote, _source: 'cwd' });
    seen.add(cwd);
  }

  if (args.userRepos) {
    for (const p of args.userRepos) {
      const abs = path.resolve(p);
      // 错误处理: 路径不存在 → warn + 跳过, 不阻断主流程
      if (!fs.existsSync(abs)) {
        console.error(`⚠️ 仓库路径不存在, 跳过: ${abs}`);
        continue;
      }
      if (!fs.statSync(abs).isDirectory()) {
        console.error(`⚠️ 不是目录, 跳过: ${abs}`);
        continue;
      }
      // 错误处理: 不是 git repo → warn + 跳过 (不是阻断错误, 用户可能路径写错)
      const isGit = !!tryExec(`git -C "${abs}" rev-parse --git-dir`);
      if (!isGit) {
        console.error(`⚠️ 不是 git repo, 跳过: ${abs}`);
        continue;
      }
      if (!seen.has(abs)) {
        const alias = path.basename(abs);
        const gitRemote = tryExec(`git -C "${abs}" config --get remote.origin.url`);
        toAdd.push({ path: abs, alias, display_name: '', git_remote: gitRemote, _source: 'user' });
        seen.add(abs);
      }
    }
  }

  repos = [...repos, ...toAdd];

  const date = args.date || new Date().toISOString().slice(0, 10);
  const authorOverride = args.author || '';
  const gitUserEmail = setting?.git_user_email || '';

  // 兜底: 合并后 repos 为空 → 不输出空报告, 提示用户, exit 0 (不阻断)
  if (repos.length === 0) {
    console.error('⚠️ 没有可采集的仓库 (cwd 不是 git, 用户指定路径全部无效)');
    console.error('   请确认 cwd 是 git 仓库, 或用 --user-repo <path> 指定有效仓库');
    console.log(JSON.stringify({ date, repos: [], totals: { hours: 0, count: 0 }, warning: 'no_repos' }, null, 2));
    process.exit(0);
  }

  const reposOut = [];
  let totalHours = 0;
  let totalCount = 0;
  let dirty = false;

  for (const repo of repos) {
    const repoPath = repo.path;
    const alias = repo.alias || path.basename(repoPath);

    // 1) Permanent storage: 已在 → touch last_used_at; 不在 → add
    //    这是 Step 1 必做, 用户给 --repo 也要存档, 下次 cwd 在这个仓库自动可用
    if (setting) {
      const idx = setting.repositories.findIndex(r => r.path === repoPath);
      if (idx !== -1) {
        if (setting.repositories[idx].last_used_at !== now) {
          setting.repositories[idx].last_used_at = now;
          dirty = true;
        }
      } else {
        const isGit = tryExec(`git -C "${repoPath}" rev-parse --git-dir`);
        const gitRemote = isGit ? tryExec(`git -C "${repoPath}" config --get remote.origin.url`) : '';
        setting.repositories = setting.repositories || [];
        setting.repositories.push({
          path: repoPath,
          alias,
          display_name: repo.display_name || '',
          git_remote: gitRemote,
          added_at: now,
          last_used_at: now,
        });
        dirty = true;
        console.error(`✅ 已存档用户指定仓库：${alias} → ${repoPath}`);
      }
    }

    // 2) Project name resolution: display_name (user override) > alias (git repo dir name) > detect-project
    const project = repo.display_name || alias || detectProject(repoPath) || '通用';

    // 3) Collect commits with timestamps
    const author = authorOverride || gitUserEmail;
    const commits = collectCommits(repoPath, date, author);

    // 0 commit → 静默跳过, 不输出 entry (避免模型困惑"这个仓库要不要用")
    if (commits.length === 0) continue;

    // 4) Hours: prefer real session span from commit timestamps (黑心老板下限 19:30).
    //    Fall back to commit-type estimate when no timestamps available.
    const repoHours = computeSessionHours(commits, date);
    const items = commits.map(c => ({
      commit: c.subject,
      time: c.time,
    }));
    const repoCount = items.length;

    totalHours += repoHours;
    totalCount += repoCount;

    reposOut.push({
      path: repoPath,
      alias,
      display_name: repo.display_name || '',
      project,
      items,
      total_hours: repoHours,
      total_count: repoCount,
    });
  }

  // 批量写盘一次 (S9: 避免 N 次 writeSetting)
  if (dirty && setting) writeSetting(setting);

  // 全部仓库都没 commit → warn + 提示用户
  if (reposOut.length === 0) {
    console.error(`⚠️ ${date} 全部仓库 (${repos.length} 个) 都没有 commit`);
    console.error('   可能原因: 今天没提交 / --author 过滤掉了所有 commit / git_user_email 配置错误');
  }

  const result = {
    date,
    repos: reposOut,
    totals: {
      hours: totalHours,
      count: totalCount,
    },
  };
  console.log(JSON.stringify(result, null, 2));
}

// ─── detect-project ─────────────────────────────────────────────────────
function detectProject(repoPath) {
  const files = fs.readdirSync(repoPath);

  // 1) package.json
  if (files.includes('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, 'package.json'), 'utf8'));
      if (pkg.name) return pkg.name;
    } catch {}
  }

  // 2) pom.xml
  if (files.includes('pom.xml')) {
    const pom = fs.readFileSync(path.join(repoPath, 'pom.xml'), 'utf8');
    const nameMatch = pom.match(/<name>([^<]+)<\/name>/);
    if (nameMatch) return nameMatch[1];
    const artMatch = pom.match(/<artifactId>([^<]+)<\/artifactId>/);
    if (artMatch) return artMatch[1];
  }

  // 3) settings.gradle / settings.gradle.kts
  for (const f of ['settings.gradle', 'settings.gradle.kts']) {
    if (files.includes(f)) {
      const content = fs.readFileSync(path.join(repoPath, f), 'utf8');
      const match = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
      if (match) return match[1];
    }
  }

  // 4) pyproject.toml
  /* cspell:disable */
  // cspell:disable-next-line
  if (files.includes('pyproject.toml')) {
    const content = fs.readFileSync(path.join(repoPath, 'pyproject.toml'), 'utf8');
    const match = content.match(/^name\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  }
  /* cspell:enable */
  /* cspell:enable */

  // 5) Cargo.toml
  if (files.includes('Cargo.toml')) {
    const content = fs.readFileSync(path.join(repoPath, 'Cargo.toml'), 'utf8');
    const match = content.match(/^name\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  }

  // 6) README.md first heading
  if (files.includes('README.md')) {
    try {
      const lines = fs.readFileSync(path.join(repoPath, 'README.md'), 'utf8').split('\n').slice(0, 20);
      for (const line of lines) {
        const m = line.match(/^#\s+(.+)/);
        if (m) return m[1].trim();
      }
    } catch {}
  }

  // 7) git remote origin URL repo name
  const remote = tryExec(`git -C "${repoPath}" config --get remote.origin.url`);
  if (remote) {
    const base = path.basename(remote.replace(/\.git$/, ''));
    if (base) return base;
  }

  // 8) Directory name
  return path.basename(repoPath);
}

// ─── collect-commits ────────────────────────────────────────────────────
// Returns array of { time: unixTs, subject: string }
function collectCommits(repoPath, date, author) {
  const since = `${date} 00:00:00`;
  const until = `${date} 23:59:59`;
  const authorArg = author ? `--author="${author}"` : '';

  // %ct = committer time (unix ts), %s = subject
  const cmd = `git -C "${repoPath}" log --since="${since}" --until="${until}" --no-merges --pretty=format:"%ct|%s" ${authorArg}`;
  const raw = tryExec(cmd);
  if (!raw) return [];

  return raw
    .split('\n')
    .filter(line => line.trim() && line.includes('|'))
    .filter(line => !/^Merge|^Revert /.test(line.split('|')[1] || ''))
    .map(line => {
      const [ts, ...rest] = line.split('|');
      return { time: parseInt(ts, 10), subject: rest.join('|').trim() };
    })
    .filter(c => !isNaN(c.time));
}

// ─── compute-session-hours ──────────────────────────────────────────────
// Compute real working hours from commit timestamps.
// Rules:
//   - 0 commit: 0
//   - 1 commit: 默认 1.5h (1-2h 中位，单 commit 无法测时长)
//   - 2+ commits: start = first, end = max(last, 19:30 下限), cap [0.5, 14]
function computeSessionHours(commits, date) {
  if (commits.length === 0) return 0;

  // 单 commit：无法测真实时长，按 1.5h 中位估
  if (commits.length === 1) return 1.5;

  const sorted = [...commits].sort((a, b) => a.time - b.time);
  const first = sorted[0].time;
  const last = sorted[sorted.length - 1].time;

  const dayStart = new Date(`${date}T09:00:00`);
  const dayEndMin = new Date(`${date}T19:30:00`);

  const startSec = Math.max(first, Math.floor(dayStart.getTime() / 1000));
  const endSec = Math.max(last, Math.floor(dayEndMin.getTime() / 1000));

  const hours = (endSec - startSec) / 3600;
  const halfHour = Math.round(hours * 2) / 2;  // 半小时粒度
  return Math.min(Math.max(halfHour, 0.5), 14);
}

// ─── clipboard subcommand ───────────────────────────────────────────────
function cmdClipboard() {
  const input = fs.readFileSync(0, 'utf8'); // stdin
  const platform = process.platform;

  let cmd, cmdArgs;
  if (platform === 'darwin') {
    cmd = 'pbcopy'; cmdArgs = [];
  } else if (platform === 'win32') {
    cmd = 'clip'; cmdArgs = [];
  } else {
    // cspell:disable-next-line
    cmd = 'xclip'; cmdArgs = ['-selection', 'clipboard'];
  }

  const child = spawn(cmd, cmdArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });

  child.on('error', err => {
    console.error(`❌ 剪贴板命令不可用：${cmd}（${err.message}）`);
    // cspell:disable-next-line
    console.error('   macOS 自带 pbcopy；Windows 自带 clip；Linux 需装 xclip（apt install xclip）');
    console.error('   日报内容已输出到 stdout，请手动 Cmd+A / Ctrl+A 复制');
    process.exit(1);
  });

  child.on('exit', code => {
    if (code === 0) {
      console.log('✅ 已自动复制到剪贴板');
      process.exit(0);
    } else {
      console.error(`❌ 剪贴板复制失败（exit ${code}）：${stderr.trim()}`);
      console.error('   日报内容已输出到 stdout，请手动复制');
      process.exit(1);
    }
  });

  child.stdin.write(input);
  child.stdin.end();
}

// ─── save-repo subcommand ───────────────────────────────────────────────
function cmdSaveRepo(args) {
  let repoPath = args.path || '';
  if (args.cwd) repoPath = process.cwd();
  if (!repoPath) {
    console.error('usage: daily-report.js save-repo --path <path> [--alias <alias>] [--cwd] [--touch]');
    process.exit(1);
  }

  // Resolve to absolute path
  try {
    repoPath = path.resolve(repoPath);
  } catch {}

  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    console.error(`❌ 目录不存在：${repoPath}`);
    process.exit(1);
  }

  const setting = readSetting();
  if (!setting) {
    console.error('❌ setting.json 不存在，先跑 init');
    process.exit(1);
  }

  const gitRemote = tryExec(`git -C "${repoPath}" config --get remote.origin.url`);
  const gitUserEmail = tryExec(`git -C "${repoPath}" config --get user.email`);
  const now = isoNow();

  // Promote git_user_email to top level if empty
  if (gitUserEmail && (!setting.git_user_email || setting.git_user_email === '')) {
    setting.git_user_email = gitUserEmail;
  }

  setting.repositories = setting.repositories || [];

  // Touch mode: only update last_used_at
  if (args.touch) {
    const idx = setting.repositories.findIndex(r => r.path === repoPath);
    if (idx === -1) {
      console.error(`⚠️ 仓库不在列表中，跳过 touch：${repoPath}`);
      process.exit(0);
    }
    setting.repositories[idx].last_used_at = now;
    writeSetting(setting);
    console.log(JSON.stringify(setting.repositories[idx], null, 2));
    return;
  }

  // 去重：same path
  const pathIdx = setting.repositories.findIndex(r => r.path === repoPath);
  if (pathIdx !== -1) {
    if (args.alias) setting.repositories[pathIdx].alias = args.alias;
    if (args.displayName) setting.repositories[pathIdx].display_name = args.displayName;
    setting.repositories[pathIdx].last_used_at = now;
    writeSetting(setting);
    console.log(`✅ 已更新（按 path 命中）：${repoPath}`);
    console.log(JSON.stringify(setting.repositories[pathIdx], null, 2));
    return;
  }

  // 去重：same git_remote
  if (gitRemote) {
    const remoteIdx = setting.repositories.findIndex(r => r.git_remote === gitRemote);
    if (remoteIdx !== -1) {
      setting.repositories[remoteIdx].path = repoPath;
      setting.repositories[remoteIdx].last_used_at = now;
      if (args.alias) setting.repositories[remoteIdx].alias = args.alias;
      if (args.displayName) setting.repositories[remoteIdx].display_name = args.displayName;
      writeSetting(setting);
      console.log(`✅ 已更新 path（按 git_remote 命中）：${setting.repositories[remoteIdx].alias}`);
      console.log(JSON.stringify(setting.repositories[remoteIdx], null, 2));
      return;
    }
  }

  // Add new
  const alias = args.alias || path.basename(repoPath);
  const newRepo = {
    path: repoPath,
    alias,
    display_name: args.displayName || '',
    git_remote: gitRemote,
    added_at: now,
    last_used_at: now,
  };
  setting.repositories.push(newRepo);
  writeSetting(setting);
  console.log(`✅ 已添加仓库：${alias} → ${repoPath}`);
  console.log(JSON.stringify(newRepo, null, 2));
}

// ─── list-repos subcommand ──────────────────────────────────────────────
function cmdListRepos(args) {
  const setting = readSetting();
  if (!setting) {
    console.error('❌ setting.json 不存在，先跑 init');
    process.exit(1);
  }

  let repos = [...(setting.repositories || [])]
    .sort((a, b) => (b.last_used_at || '').localeCompare(a.last_used_at || ''));

  // --auto-detect-cwd: cwd 是 git repo → 永久存档（已存在则 touch，不在则 add）
  // 这是 Step 1 必做操作, 无论用户是否给 --repo 都要执行
  if (args.autoDetectCwd) {
    const cwd = process.cwd();
    const isGit = tryExec(`git -C "${cwd}" rev-parse --git-dir`);
    if (isGit) {
      const idx = setting.repositories.findIndex(r => r.path === cwd);
      const now = isoNow();
      if (idx !== -1) {
        // 已在存档 → 仅 touch last_used_at
        setting.repositories[idx].last_used_at = now;
        repos = repos.map(r => r.path === cwd ? { ...r, last_used_at: now } : r);
        console.error(`✅ cwd 已存档，touch last_used_at：${path.basename(cwd)}`);
      } else {
        // 不在存档 → 新增 + 永久写盘
        const alias = path.basename(cwd);
        const gitRemote = tryExec(`git -C "${cwd}" config --get remote.origin.url`);
        const newRepo = {
          path: cwd,
          alias,
          display_name: '',
          git_remote: gitRemote,
          added_at: now,
          last_used_at: now,
        };
        setting.repositories = setting.repositories || [];
        setting.repositories.push(newRepo);
        repos = [newRepo, ...repos];
        console.error(`✅ 已自动存档当前仓库：${alias} → ${cwd}`);
      }
      writeSetting(setting);
    }
  }

  if (args.current) {
    const cwd = process.cwd();
    const hit = repos.find(r => r.path === cwd);
    console.log(hit ? hit.alias : '');
    return;
  }

  if (args.json) {
    console.log(JSON.stringify(repos, null, 2));
    return;
  }

  // Human-readable table
  if (repos.length === 0) {
    console.error('（暂无保存的仓库）');
    return;
  }

  for (const r of repos) {
    console.log(`${r.alias}\t${r.path}\t${r.git_remote || '-'}\t${r.last_used_at || '-'}`);
  }
}

// ─── set-display-name subcommand ────────────────────────────────────────
// 模型翻译后存档：把中文名写到对应 repo 的 display_name。
// 用法: node scripts/daily-report.js set-display-name --path <repo-path> --name "<中文名>"
function cmdSetDisplayName(args) {
  if (!args.path || !args.name) {
    console.error('usage: daily-report.js set-display-name --path <repo-path> --name "<中文名>"');
    process.exit(1);
  }

  const setting = readSetting();
  if (!setting) {
    console.error('❌ setting.json 不存在，先跑 init');
    process.exit(1);
  }

  const repoPath = path.resolve(args.path);
  const idx = (setting.repositories || []).findIndex(r => r.path === repoPath);
  if (idx === -1) {
    console.error(`❌ 仓库不在列表中：${repoPath}`);
    process.exit(1);
  }

  setting.repositories[idx].display_name = args.name;
  writeSetting(setting);
  console.log(`✅ 已存档翻译：${setting.repositories[idx].alias} → ${args.name}`);
  console.log(JSON.stringify(setting.repositories[idx], null, 2));
}

// ─── CLI parser ─────────────────────────────────────────────────────────
function parseArgs(rawArgs) {
  const args = {};
  for (let i = 0; i < rawArgs.length; i++) {
    switch (rawArgs[i]) {
      case '--role':      args.role = rawArgs[++i]; break;
      case '--auto-copy': args.autoCopy = rawArgs[++i]; break;
      case '--repos':     args.repos = rawArgs[++i]; break;
      case '--date':      args.date = rawArgs[++i]; break;
      case '--author':    args.author = rawArgs[++i]; break;
      case '--user-repo':
        args.userRepos = args.userRepos || [];
        args.userRepos.push(rawArgs[++i]);
        break;
      case '--path':      args.path = rawArgs[++i]; break;
      case '--alias':     args.alias = rawArgs[++i]; break;
      case '--display-name': args.displayName = rawArgs[++i]; break;
      case '--name':        args.name = rawArgs[++i]; break;
      case '--cwd':       args.cwd = true; break;
      case '--touch':     args.touch = true; break;
      case '--json':      args.json = true; break;
      case '--current':   args.current = true; break;
      case '--auto-detect-cwd': args.autoDetectCwd = true; break;
      default:
        if (!args.command) args.command = rawArgs[i];
        else console.error(`unknown arg: ${rawArgs[i]}`);
    }
  }
  return args;
}

// ─── Main ───────────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
const command = args.command || 'init';

switch (command) {
  case 'init':       cmdInit(args); break;
  case 'gather':     cmdGather(args); break;
  case 'clipboard':  cmdClipboard(); break;
  case 'save-repo':  cmdSaveRepo(args); break;
  case 'list-repos': cmdListRepos(args); break;
  case 'set-display-name': cmdSetDisplayName(args); break;
  default:
    console.error(`unknown command: ${command}`);
    console.error('available: init, gather, clipboard, save-repo, list-repos');
    process.exit(1);
}
