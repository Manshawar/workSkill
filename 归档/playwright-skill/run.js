#!/usr/bin/env node
/**
 * Playwright Skill 执行器
 *
 * 用法：
 *   node run.js script.js              # 执行脚本文件（保原路径 __dirname）
 *   node run.js script.js -- --flag x  # 透传参数给脚本
 *   node run.js "await page.goto"      # 执行内联代码
 *   cat script.js | node run.js        # 从 stdin 执行
 *
 * 核心职责：保证 playwright 从本 skill 的 node_modules 解析；
 * 对「已有完整脚本文件」用 spawn 原路径执行，避免改写临时文件导致 __dirname 错位。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL_DIR = __dirname;
process.chdir(SKILL_DIR);

const args = process.argv.slice(2);
const nodePathSep = process.platform === 'win32' ? ';' : ':';
const envWithModules = {
  ...process.env,
  NODE_PATH: [path.join(SKILL_DIR, 'node_modules'), process.env.NODE_PATH]
    .filter(Boolean)
    .join(nodePathSep),
};

function splitPassthrough(argv) {
  const dash = argv.indexOf('--');
  if (dash >= 0) return { head: argv.slice(0, dash), passthrough: argv.slice(dash + 1) };
  return { head: argv, passthrough: [] };
}

function wrapAndRequire(code, label) {
  let wrapped = code;
  const hasRequire = code.includes('require(');
  const hasAsync = /\(async\s*\(\s*\)\s*=>/.test(code);
  if (!hasRequire) {
    wrapped = `
const { chromium, firefox, webkit } = require('playwright');
const helpers = require('./lib/helpers');

(async () => {
  try {
    ${code}
  } catch (e) {
    console.error('❌ 执行失败：', e.message);
    process.exit(1);
  }
})();
`;
  } else if (!hasAsync) {
    wrapped = `
(async () => {
  try {
    ${code}
  } catch (e) {
    console.error('❌ 执行失败：', e.message);
    process.exit(1);
  }
})();
`;
  }
  console.log(label);
  const tmpFile = path.join(SKILL_DIR, `.run-${Date.now()}.js`);
  fs.writeFileSync(tmpFile, wrapped, 'utf8');
  try {
    require(tmpFile);
  } finally {
    setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) {} }, 5000).unref();
  }
}

const { head, passthrough } = splitPassthrough(args);

if (head.length > 0 && fs.existsSync(head[0])) {
  const scriptPath = path.resolve(head[0]);
  const code = fs.readFileSync(scriptPath, 'utf8');
  const isFullScript = /require\s*\(/.test(code) && /\(async\s*\(\s*\)\s*=>/.test(code);

  if (isFullScript) {
    console.log(`📄 spawn file (keep __dirname): ${scriptPath}`);
    if (passthrough.length) console.log(`   args: ${passthrough.join(' ')}`);
    const r = spawnSync(process.execPath, [scriptPath, ...passthrough], {
      stdio: 'inherit',
      env: envWithModules,
      cwd: path.dirname(scriptPath),
    });
    process.exit(r.status == null ? 1 : r.status);
  } else {
    wrapAndRequire(code, `📄 执行文件（wrap）：${scriptPath}`);
  }
} else if (head.length > 0) {
  wrapAndRequire(head.join(' '), '⚡ 执行内联代码');
} else if (!process.stdin.isTTY) {
  wrapAndRequire(fs.readFileSync(0, 'utf8'), '📥 从 stdin 读取');
} else {
  console.error('用法：node run.js <script.js | "inline code"> [-- script-args...]');
  process.exit(1);
}
