#!/usr/bin/env node
/**
 * Initialize .loopfix/ skeleton in the current project (cwd).
 * Idempotent: does not overwrite existing files unless --force.
 *
 * Usage:
 *   node init_loopfix.js [--cwd <path>] [--force]
 *   node init_loopfix.js --status [--cwd <path>]
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = { cwd: process.cwd(), force: false, status: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") out.force = true;
    else if (a === "--status") out.status = true;
    else if (a === "--cwd") out.cwd = path.resolve(argv[++i] || "");
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content, force) {
  if (fs.existsSync(filePath) && !force) {
    return "skipped";
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return fs.existsSync(filePath) && !force ? "written" : force ? "overwritten" : "written";
}

function copyAsset(src, dest, force) {
  if (fs.existsSync(dest) && !force) return "skipped";
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return force && fs.existsSync(dest) ? "overwritten" : "written";
}

function checkStatus(root) {
  const required = [
    "config.yaml",
    "references/agent-browser.md",
    "browser/probes",
    "knowledge/drafts",
    "runs",
  ];
  const missing = [];
  for (const rel of required) {
    if (!fs.existsSync(path.join(root, rel))) missing.push(rel);
  }
  return {
    root,
    exists: missing.length === 0,
    missing,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node init_loopfix.js [--cwd <path>] [--force] [--status]`);
    process.exit(0);
  }

  const skillDir = path.resolve(__dirname, "..");
  const assetsDir = path.join(skillDir, "assets");
  const root = path.join(args.cwd, ".loopfix");

  if (args.status) {
    console.log(JSON.stringify({ ok: true, ...checkStatus(root) }, null, 2));
    process.exit(0);
  }

  const actions = [];

  const dirs = [
    "references",
    "browser/probes",
    "knowledge/drafts",
    "runs",
  ];
  for (const d of dirs) {
    const full = path.join(root, d);
    ensureDir(full);
    actions.push({ path: d, action: "mkdir" });
  }

  // .gitkeep for empty dirs
  for (const d of ["browser/probes", "knowledge/drafts", "runs"]) {
    const gk = path.join(root, d, ".gitkeep");
    const r = writeFile(gk, "", args.force);
    actions.push({ path: `${d}/.gitkeep`, action: r });
  }

  const copies = [
    ["config.yaml", "config.yaml"],
    ["agent-browser.md", "references/agent-browser.md"],
    ["probe.example.yaml", "browser/probes/_example.login.yaml"],
  ];

  for (const [srcName, destRel] of copies) {
    const src = path.join(assetsDir, srcName);
    if (!fs.existsSync(src)) {
      actions.push({ path: destRel, action: "error", error: `missing asset ${srcName}` });
      continue;
    }
    // never force-overwrite example probe unless --force; example can stay as template
    const dest = path.join(root, destRel);
    const r = copyAsset(src, dest, args.force);
    actions.push({ path: destRel, action: r });
  }

  const status = checkStatus(root);
  console.log(
    JSON.stringify(
      {
        ok: status.exists,
        root,
        force: args.force,
        status: status.exists ? "ready" : "incomplete",
        missing: status.missing,
        actions,
      },
      null,
      2
    )
  );
  process.exit(status.exists ? 0 : 1);
}

main();
