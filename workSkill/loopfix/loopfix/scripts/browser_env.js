#!/usr/bin/env node
/**
 * Resolve sticky agent-browser session for this project.
 * Prevents new Cursor windows from opening a cold browser + re-login.
 *
 * Usage:
 *   node browser_env.js [--cwd <path>]
 *   node browser_env.js --export   # shell: eval $(node browser_env.js --export)
 *
 * Output JSON (default):
 *   { session, restore, headed, args, env }
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function parseArgs(argv) {
  const out = { cwd: process.cwd(), exportShell: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--cwd") out.cwd = path.resolve(argv[++i] || "");
    else if (argv[i] === "--export") out.exportShell = true;
    else if (argv[i] === "--help" || argv[i] === "-h") out.help = true;
  }
  return out;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "app";
}

function findLoopfixRoot(cwd) {
  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".loopfix", "config.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(cwd);
    dir = parent;
  }
}

function readConfig(projectRoot) {
  const cfgPath = path.join(projectRoot, ".loopfix", "config.yaml");
  if (!fs.existsSync(cfgPath)) return {};
  const text = fs.readFileSync(cfgPath, "utf8");
  // Minimal YAML subset for browser.* keys (no dependency)
  const browser = {};
  let inBrowser = false;
  for (const line of text.split("\n")) {
    if (/^browser:\s*$/.test(line)) {
      inBrowser = true;
      continue;
    }
    if (inBrowser && /^\S/.test(line) && !/^\s/.test(line)) break;
    if (!inBrowser) continue;
    const m = line.match(/^\s+([a-z_]+):\s*(.+?)\s*$/i);
    if (!m) continue;
    let v = m[2].replace(/#.*$/, "").trim().replace(/^["']|["']$/g, "");
    if (v === "true") v = true;
    else if (v === "false") v = false;
    browser[m[1]] = v;
  }
  return { browser };
}

function resolveSessionId(projectRoot, configured) {
  if (configured && configured !== "auto") return String(configured);

  // Prefer agent-browser stable worktree id when CLI available
  try {
    const prefix = `loopfix-${slug(path.basename(projectRoot))}`;
    const id = execSync(
      `agent-browser session id --scope worktree --prefix ${prefix}`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    if (id) return id;
  } catch {
    /* fallback below */
  }
  return `loopfix-${slug(path.basename(projectRoot))}`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log("Usage: node browser_env.js [--cwd <path>] [--export]");
    process.exit(0);
  }

  const projectRoot = findLoopfixRoot(args.cwd);
  const cfg = readConfig(projectRoot);
  const b = cfg.browser || {};

  const session = resolveSessionId(projectRoot, b.session);
  const restore = b.restore !== false;
  const headed = b.headed !== false;

  const flagParts = [`--session ${session}`];
  if (restore) flagParts.push("--restore");
  if (headed) flagParts.push("--headed");
  const flags = flagParts.join(" ");

  const env = {
    AGENT_BROWSER_SESSION: session,
    AGENT_BROWSER_RESTORE: restore ? "1" : "0",
    AGENT_BROWSER_HEADED: headed ? "1" : "0",
  };

  if (args.exportShell) {
    for (const [k, v] of Object.entries(env)) {
      console.log(`export ${k}=${JSON.stringify(String(v))}`);
    }
    process.exit(0);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        project_root: projectRoot,
        session,
        restore,
        headed,
        flags,
        open_example: `agent-browser ${flags} open <url>`,
        env,
        note: "Reuse these flags in every agent-browser call in this project. Do not close --all on shared session.",
      },
      null,
      2
    )
  );
}

main();
