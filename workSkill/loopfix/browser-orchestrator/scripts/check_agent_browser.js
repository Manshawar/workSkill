#!/usr/bin/env node
/**
 * Verify agent-browser CLI is available before LoopFix browser work.
 * Does not install — prints instructions for user.
 *
 * Usage:
 *   node check_agent_browser.js [--json]
 */

const { execSync } = require("child_process");

const INSTALL = {
  skill: "npx skills add vercel-labs/agent-browser",
  cli: "npm install -g agent-browser",
  chrome: "agent-browser install",
};

function hasCli() {
  try {
    execSync("agent-browser --help", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const jsonOnly = process.argv.includes("--json");
  const ok = hasCli();

  const payload = {
    ok,
    cli_installed: ok,
    message: ok
      ? "agent-browser CLI is available."
      : "agent-browser CLI not found. Install before LoopFix browser execution.",
    install: ok ? null : INSTALL,
    install_steps: ok
      ? []
      : [
          "1. Add official skill (Cursor / skills registry):",
          `   ${INSTALL.skill}`,
          "2. Install CLI globally:",
          `   ${INSTALL.cli}`,
          "3. Download Chrome for Testing (first time only):",
          `   ${INSTALL.chrome}`,
        ],
  };

  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    process.exit(ok ? 0 : 1);
  }

  if (ok) {
    console.log(payload.message);
    process.exit(0);
  }

  console.error(payload.message);
  console.error("");
  for (const line of payload.install_steps) {
    console.error(line);
  }
  process.exit(1);
}

main();
