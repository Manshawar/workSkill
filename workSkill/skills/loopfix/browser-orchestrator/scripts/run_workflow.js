#!/usr/bin/env node
/**
 * Execute a LoopFix browser workflow via official agent-browser (batch).
 * LLM must not step-click — this script owns the run.
 *
 * Usage:
 *   node run_workflow.js <workflow-id|path> [--cwd <project>] [--dry-run] [--base-url <url>] [--no-bail]
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

function parseArgs(argv) {
  const out = {
    cwd: process.cwd(),
    dryRun: false,
    baseUrl: null,
    workflow: null,
    noBail: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--cwd") out.cwd = path.resolve(argv[++i] || "");
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--no-bail") out.noBail = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (!a.startsWith("-") && !out.workflow) out.workflow = a;
  }
  return out;
}

function findProjectRoot(cwd) {
  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".loopfix"))) return dir;
    const p = path.dirname(dir);
    if (p === dir) return path.resolve(cwd);
    dir = p;
  }
}

function findLoopfixSkillDir() {
  const candidates = [
    path.resolve(__dirname, "..", "..", "loopfix"), // skills/loopfix/browser-orchestrator → sibling loopfix/
    path.resolve(__dirname, "..", "..", "loopfix", "loopfix"),
    path.resolve(__dirname, ".."), // flat single-skill install
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "scripts", "browser_env.js"))) return c;
  }
  let dir = path.resolve(__dirname, "..");
  for (let i = 0; i < 8; i++) {
    const nested = path.join(dir, "loopfix", "scripts", "browser_env.js");
    if (fs.existsSync(nested)) return path.join(dir, "loopfix");
    dir = path.dirname(dir);
  }
  return null;
}

/** Returned in JSON when spawn fails — AI installs on demand, no pre-check script. */
const AGENT_BROWSER_INSTALL = {
  skill: "npx skills add vercel-labs/agent-browser",
  cli: "npm install -g agent-browser",
  chrome: "agent-browser install",
};

function agentBrowserMissing(res) {
  if (!res || !res.error) return false;
  const msg = String(res.error.message || res.error);
  return res.error.code === "ENOENT" || /spawn agent-browser/i.test(msg);
}

function exitAgentBrowserMissing(ctx) {
  const ended = new Date().toISOString();
  const evidence = {
    run_id: ctx.rid,
    workflow: ctx.workflowId,
    workflow_path: ctx.workflowPath,
    status: "AGENT_BROWSER_MISSING",
    started_at: ctx.started,
    ended_at: ended,
    session: ctx.browser.session,
    steps: [],
    errors: ["agent-browser CLI not found"],
    install: AGENT_BROWSER_INSTALL,
    unknown_actions: [],
    expect_failures: [],
  };
  writeEvidence(ctx.runDir, evidence);
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: "AGENT_BROWSER_MISSING",
        message: "agent-browser CLI not found. Install before browser execution.",
        install: AGENT_BROWSER_INSTALL,
        run_id: ctx.rid,
        evidence: path.join(ctx.runDir, "evidence.json"),
      },
      null,
      2
    )
  );
  process.exit(2);
}

/** Minimal YAML subset → JS (maps/lists/scalars). Good enough for workflow/action files. */
function parseYaml(text) {
  const lines = text.replace(/\t/g, "  ").split(/\r?\n/);
  let i = 0;

  function indentOf(line) {
    const m = line.match(/^ */);
    return m ? m[0].length : 0;
  }

  /** Split flow map/seq inner on top-level commas (respect quotes + nested {} []). */
  function splitFlowItems(inner) {
    const items = [];
    let cur = "";
    let depth = 0;
    let quote = null;
    for (let j = 0; j < inner.length; j++) {
      const ch = inner[j];
      if (quote) {
        cur += ch;
        if (ch === "\\" && quote === '"') {
          cur += inner[++j] || "";
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        cur += ch;
        continue;
      }
      if (ch === "{" || ch === "[") {
        depth++;
        cur += ch;
        continue;
      }
      if (ch === "}" || ch === "]") {
        depth--;
        cur += ch;
        continue;
      }
      if (ch === "," && depth === 0) {
        items.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) items.push(cur.trim());
    return items;
  }

  function parseFlowCollection(s) {
    const t = s.trim();
    if (t.startsWith("{") && t.endsWith("}")) {
      const obj = {};
      for (const item of splitFlowItems(t.slice(1, -1))) {
        if (!item) continue;
        const ci = item.indexOf(":");
        if (ci < 0) continue;
        const k = item.slice(0, ci).trim();
        const v = item.slice(ci + 1).trim();
        obj[k] = parseValue(v);
      }
      return obj;
    }
    if (t.startsWith("[") && t.endsWith("]")) {
      return splitFlowItems(t.slice(1, -1)).map((x) => parseValue(x));
    }
    return t;
  }

  function parseValue(raw) {
    let s = raw.trim();
    if (s === "" || s === "null" || s === "~") return null;
    if (s === "true") return true;
    if (s === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
      return s.slice(1, -1);
    // Inline flow maps/seqs: { type: open } / [a, b]
    if (s.startsWith("{") || s.startsWith("[")) {
      const closed =
        (s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"));
      if (closed) return parseFlowCollection(s);
    }
    // strip unquoted trailing comment
    if (!s.includes('"') && !s.includes("'")) s = s.replace(/\s+#.*$/, "").trim();
    return s;
  }

  function parseBlock(minIndent) {
    let obj = null;
    let arr = null;

    while (i < lines.length) {
      let line = lines[i];
      if (!line.trim() || line.trim().startsWith("#")) {
        i++;
        continue;
      }
      const ind = indentOf(line);
      if (ind < minIndent) break;
      const trimmed = line.trim();

      if (trimmed.startsWith("- ")) {
        if (!arr) arr = [];
        const rest = trimmed.slice(2);
        i++;
        if (rest.includes(":") && !rest.startsWith("{")) {
          const ci = rest.indexOf(":");
          const k = rest.slice(0, ci).trim();
          const v = rest.slice(ci + 1).trim();
          const item = {};
          if (v === "") {
            item[k] = parseBlock(ind + 2);
          } else {
            item[k] = parseValue(v);
            while (i < lines.length) {
              const l2 = lines[i];
              if (!l2.trim() || l2.trim().startsWith("#")) {
                i++;
                continue;
              }
              const ind2 = indentOf(l2);
              if (ind2 <= ind) break;
              const t2 = l2.trim();
              if (t2.startsWith("- ")) break;
              const c2 = t2.indexOf(":");
              if (c2 < 0) break;
              i++;
              const kk = t2.slice(0, c2).trim();
              const vv = t2.slice(c2 + 1).trim();
              item[kk] = vv === "" ? parseBlock(ind2 + 2) : parseValue(vv);
            }
          }
          arr.push(item);
        } else if (rest === "") {
          arr.push(parseBlock(ind + 2));
        } else {
          arr.push(parseValue(rest));
        }
        continue;
      }

      const c = trimmed.indexOf(":");
      if (c < 0) {
        i++;
        continue;
      }
      if (!obj) obj = {};
      const key = trimmed.slice(0, c).trim();
      const val = trimmed.slice(c + 1).trim();
      i++;
      if (val === "") {
        obj[key] = parseBlock(ind + 2);
      } else {
        obj[key] = parseValue(val);
      }
    }
    return arr || obj || {};
  }

  i = 0;
  return parseBlock(0);
}

function readYamlFile(file) {
  return parseYaml(fs.readFileSync(file, "utf8"));
}

function loadIndex(workflowsDir) {
  const idx = path.join(workflowsDir, "index.yaml");
  if (!fs.existsSync(idx)) return null;
  return readYamlFile(idx);
}

function resolveWorkflowPath(projectRoot, workflowArg) {
  const wfRoot = path.join(projectRoot, ".loopfix", "browser", "workflows");
  if (workflowArg.endsWith(".yaml") || workflowArg.endsWith(".yml")) {
    const abs = path.isAbsolute(workflowArg)
      ? workflowArg
      : path.join(projectRoot, workflowArg);
    if (fs.existsSync(abs)) return abs;
    const under = path.join(wfRoot, workflowArg);
    if (fs.existsSync(under)) return under;
  }
  const index = loadIndex(wfRoot);
  if (index && index.workflows && index.workflows[workflowArg]) {
    const rel = index.workflows[workflowArg].path;
    return path.join(wfRoot, rel);
  }
  // direct search
  const direct = path.join(wfRoot, `${workflowArg}.yaml`);
  if (fs.existsSync(direct)) return direct;
  throw Object.assign(new Error(`Workflow not found: ${workflowArg}`), { code: "NOT_FOUND" });
}

function findActionFile(actionsRoot, useId) {
  // ui.dialog.open → ui/dialog.open.yaml or ui/dialog/open.yaml or dialog.open under ui
  const parts = String(useId).split(".");
  const candidates = [
    path.join(actionsRoot, ...parts.slice(0, -1), `${parts[parts.length - 1]}.yaml`),
    path.join(actionsRoot, parts[0], `${parts.slice(1).join(".")}.yaml`),
    path.join(actionsRoot, parts[0], parts.slice(1).join("/") + ".yaml"),
    path.join(actionsRoot, `${useId.replace(/\./g, "/")}.yaml`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function interpolate(obj, params) {
  if (obj == null) return obj;
  if (typeof obj === "string") {
    return obj.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      params && params[k] != null ? String(params[k]) : `{{${k}}}`
    );
  }
  if (Array.isArray(obj)) return obj.map((x) => interpolate(x, params));
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = interpolate(v, params);
    return out;
  }
  return obj;
}

/** Match action when: { intent: open } against workflow params */
function whenMatches(when, params) {
  if (when == null) return true;
  if (typeof when !== "object") return true;
  for (const [k, v] of Object.entries(when)) {
    const pv = params && params[k];
    if (pv == null) continue; // unspecified param → allow branch
    if (String(pv) !== String(v)) return false;
  }
  return true;
}

/** Normalize do-item to { action: { type }, target?, params? } */
function normalizeDoItem(d, fallbackId) {
  if (!d || typeof d !== "object") return null;
  if (typeof d.action === "string") {
    return {
      id: d.id || fallbackId,
      action: { type: d.action },
      target: d.target,
      params: d.params || {},
      expect: d.expect,
    };
  }
  if (d.action && typeof d.action === "object") {
    return {
      id: d.id || fallbackId,
      action: d.action.type ? d.action : { type: d.action.type || d.type, ...d.action },
      target: d.target,
      params: d.params || {},
      expect: d.expect,
    };
  }
  if (d.type) {
    return {
      id: d.id || fallbackId,
      action: { type: d.type },
      target: d.target,
      params: d.params || {},
      expect: d.expect,
    };
  }
  return { id: fallbackId, ...d };
}

/**
 * Expand Action file steps. Supports:
 * - native: steps: [{ action: { type }, target }]
 * - when/do: steps: [{ when: { intent: open }, do: [...] }]  (S7)
 */
function actionDefToSteps(def, mergedParams) {
  let raw = def.steps;
  if (!raw || !raw.length) {
    if (def.when || def.do) raw = [{ when: def.when, do: def.do }];
    else return [];
  }
  const out = [];
  let i = 0;
  for (const s of raw) {
    if (s && (s.do != null || s.when != null)) {
      if (!whenMatches(s.when, mergedParams)) continue;
      const dos = Array.isArray(s.do) ? s.do : s.do ? [s.do] : [];
      for (const d of dos) {
        const n = normalizeDoItem(d, s.id || `step-${i++}`);
        if (n) out.push(n);
      }
    } else {
      out.push(s);
    }
  }
  return out;
}

function expandSteps(steps, actionsRoot, params, unknown) {
  const out = [];
  for (const step of steps || []) {
    const action = step.action || {};
    if (action.use) {
      const file = findActionFile(actionsRoot, action.use);
      if (!file) {
        unknown.push({ step_id: step.id, use: action.use });
        out.push({ ...step, _unknown: true });
        continue;
      }
      const def = readYamlFile(file);
      const mergedParams = { ...(params || {}), ...(step.params || {}) };
      const inner = interpolate(actionDefToSteps(def, mergedParams), mergedParams);
      for (const s of expandSteps(inner, actionsRoot, mergedParams, unknown)) {
        out.push({
          ...s,
          id: s.id || `${step.id}.${s.id || "step"}`,
          _from: action.use,
        });
      }
    } else {
      out.push(
        interpolate(
          { ...step, params: { ...params, ...step.params } },
          { ...params, ...step.params }
        )
      );
    }
  }
  return out;
}

function targetToFindArgs(target) {
  if (!target) return null;
  if (target.ref) return { mode: "ref", value: target.ref };
  if (target.role) {
    const args = ["find", "role", target.role];
    return { mode: "find", args, name: target.name, value: null };
  }
  if (target.label) return { mode: "find", args: ["find", "label", target.label] };
  if (target.text) return { mode: "find", args: ["find", "text", target.text] };
  if (target.placeholder)
    return { mode: "find", args: ["find", "placeholder", target.placeholder] };
  return null;
}

function stepToCommands(step, ctx) {
  const cmds = [];
  if (step._unknown) return cmds;
  const type = (step.action && step.action.type) || "snapshot";
  const params = step.params || {};
  const t = targetToFindArgs(step.target);

  if (type === "open") {
    let url = params.url || "/";
    if (url.startsWith("/") && ctx.baseUrl) url = ctx.baseUrl.replace(/\/$/, "") + url;
    cmds.push(["open", url]);
    return cmds;
  }
  if (type === "wait") {
    // S1: mask-aware — wait until selector gone (loading overlay)
    const gone =
      params.selector_gone ||
      params.mask_gone ||
      params.hidden ||
      (params.state === "hidden" && params.selector);
    if (gone) {
      cmds.push(["wait", String(gone), "--state", "hidden"]);
    } else if (params.load) {
      cmds.push(["wait", "--load", String(params.load)]);
    } else if (params.ms) {
      cmds.push(["wait", String(params.ms)]);
    } else if (params.text) {
      cmds.push(["wait", "--text", String(params.text)]);
    } else if (params.fn) {
      cmds.push(["wait", "--fn", String(params.fn)]);
    } else if (params.selector) {
      cmds.push(["wait", String(params.selector)]);
    }
    return cmds;
  }
  if (type === "snapshot") {
    cmds.push(["snapshot", "-i"]);
    return cmds;
  }
  if (type === "screenshot") {
    const p =
      params.path ||
      path.join(ctx.runDir, "screenshot", `${step.id || "shot"}.png`);
    cmds.push(["screenshot", p]);
    return cmds;
  }

  const verb = type === "type" ? "type" : type;
  if (t && t.mode === "ref") {
    if (verb === "fill" || verb === "type")
      cmds.push([verb, t.value, String(params.value ?? "")]);
    else cmds.push([verb, t.value]);
    return cmds;
  }
  if (t && t.mode === "find") {
    const args = [...t.args];
    if (verb === "fill" || verb === "type") {
      args.push(verb, String(params.value ?? ""));
    } else {
      args.push(verb);
    }
    if (step.target && step.target.name && t.args[1] === "role") {
      args.push("--name", String(step.target.name));
    }
    cmds.push(args);
    return cmds;
  }

  // cannot resolve target
  step._unresolved_target = true;
  return cmds;
}

function getBrowserEnv(projectRoot) {
  const loopfix = findLoopfixSkillDir();
  if (!loopfix) {
    return {
      session: `loopfix-${path.basename(projectRoot)}`,
      flags: [],
      env: { ...process.env },
    };
  }
  try {
    const out = execSync(`node "${path.join(loopfix, "scripts", "browser_env.js")}" --cwd "${projectRoot}"`, {
      encoding: "utf8",
    });
    const j = JSON.parse(out);
    const env = { ...process.env, ...j.env };
    return { session: j.session, flags: j.flags.split(/\s+/).filter(Boolean), env, raw: j };
  } catch {
    return { session: null, flags: ["--headed"], env: process.env };
  }
}

function runId(workflowId) {
  const d = new Date();
  const day = d.toISOString().slice(0, 10).replace(/-/g, "");
  const slug = String(workflowId).replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  return `${day}-${slug}-${Math.random().toString(16).slice(2, 6)}`;
}

function writeEvidence(runDir, evidence) {
  fs.mkdirSync(path.join(runDir, "screenshot"), { recursive: true });
  fs.writeFileSync(path.join(runDir, "evidence.json"), JSON.stringify(evidence, null, 2));
  const lines = [
    `# Run ${evidence.run_id}`,
    "",
    `- Workflow: ${evidence.workflow}`,
    `- Status: **${evidence.status}**`,
    `- Session: ${evidence.session || ""}`,
    "",
    "## Steps",
    ...evidence.steps.map((s) => `- ${s.id}: ${s.status}${s.detail ? ` — ${s.detail}` : ""}`),
    "",
  ];
  if (evidence.unknown_actions?.length) {
    lines.push("## UNKNOWN_ACTION", ...evidence.unknown_actions.map((u) => `- ${u.step_id}: ${u.use}`), "");
  }
  fs.writeFileSync(path.join(runDir, "report.md"), lines.join("\n"));
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.workflow) {
    console.log("Usage: node run_workflow.js <workflow-id|path> [--cwd <project>] [--dry-run] [--base-url <url>] [--no-bail]");
    process.exit(args.help ? 0 : 1);
  }

  const projectRoot = findProjectRoot(args.cwd);
  const actionsRoot = path.join(projectRoot, ".loopfix", "browser", "actions");
  const runsRoot = path.join(projectRoot, ".loopfix", "runs");

  let wfPath;
  try {
    wfPath = resolveWorkflowPath(projectRoot, args.workflow);
  } catch (e) {
    console.log(JSON.stringify({ ok: false, status: "FAIL", error: e.message }));
    process.exit(1);
  }

  const workflow = readYamlFile(wfPath);
  const workflowId = workflow.id || path.basename(wfPath, path.extname(wfPath));
  const baseUrl = args.baseUrl || workflow.base_url || "";
  const unknown = [];
  const expanded = expandSteps(workflow.steps || [], actionsRoot, {}, unknown);

  if (unknown.length) {
    const rid = runId(workflowId);
    const runDir = path.join(runsRoot, rid);
    const evidence = {
      run_id: rid,
      workflow: workflowId,
      workflow_path: path.relative(projectRoot, wfPath),
      status: "UNKNOWN_ACTION",
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      session: null,
      steps: expanded.map((s) => ({
        id: s.id,
        status: s._unknown ? "UNKNOWN_ACTION" : "SKIP",
        action: s.action?.use || s.action?.type,
        detail: s._unknown ? `missing action ${s.action.use}` : "",
      })),
      unknown_actions: unknown,
      errors: [],
      expect_failures: [],
    };
    writeEvidence(runDir, evidence);
    console.log(JSON.stringify({ ok: false, status: "UNKNOWN_ACTION", run_id: rid, evidence: path.join(runDir, "evidence.json"), unknown_actions: unknown }, null, 2));
    process.exit(2);
  }

  const browser = getBrowserEnv(projectRoot);
  const rid = runId(workflowId);
  const runDir = path.join(runsRoot, rid);
  fs.mkdirSync(path.join(runDir, "screenshot"), { recursive: true });

  const ctx = { baseUrl, runDir };
  const plan = [];
  for (const step of expanded) {
    const cmds = stepToCommands(step, ctx);
    if (step._unresolved_target) {
      console.log(
        JSON.stringify({
          ok: false,
          status: "UNKNOWN_ACTION",
          error: `unresolved target on step ${step.id}`,
          step,
        }, null, 2)
      );
      process.exit(2);
    }
    plan.push({ step_id: step.id, commands: cmds, expect: step.expect || null });
  }

  if (args.dryRun) {
    const started = new Date().toISOString();
    const evidence = {
      run_id: rid,
      workflow: workflowId,
      workflow_path: path.relative(projectRoot, wfPath),
      status: "DRY_RUN",
      started_at: started,
      ended_at: started,
      session: browser.session,
      plan,
      steps: plan.map((p) => ({
        id: p.step_id,
        status: "PLANNED",
        action: "",
        detail: `${(p.commands || []).length} cmd(s)`,
      })),
      unknown_actions: [],
      errors: [],
      expect_failures: [],
      batch_command_count: plan.reduce((n, p) => n + (p.commands || []).length, 0),
    };
    writeEvidence(runDir, evidence);
    console.log(
      JSON.stringify(
        {
          ok: true,
          status: "DRY_RUN",
          workflow: workflowId,
          session: browser.session,
          run_id: rid,
          evidence: path.join(runDir, "evidence.json"),
          plan,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const stepResults = [];
  const expectFailures = [];
  let errors = [];
  let status = "PASS";

  function cmdToBatchString(cmd) {
    return cmd.map((c) => (/\s/.test(String(c)) ? JSON.stringify(String(c)) : String(c))).join(" ");
  }

  function scrubNoise(text) {
    // S5: drop restore:missing spam
    return String(text || "")
      .split("\n")
      .filter((l) => !/restore:\s*missing/i.test(l))
      .join("\n")
      .trim();
  }

  function runAgentBrowser(batchStrings, useBail) {
    const abArgs = [...browser.flags, "batch"];
    if (useBail) abArgs.push("--bail");
    abArgs.push(...batchStrings);
    return spawnSync("agent-browser", abArgs, {
      env: browser.env,
      encoding: "utf8",
      cwd: projectRoot,
    });
  }

  const started = new Date().toISOString();
  const missingCtx = {
    rid,
    workflowId,
    workflowPath: path.relative(projectRoot, wfPath),
    runDir,
    browser,
    started,
  };

  if (args.noBail) {
    // S2: per-step execution — keep PASS/FAIL for each step
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const strings = (p.commands || []).map(cmdToBatchString);
      if (!strings.length) {
        stepResults.push({
          id: p.step_id,
          status: "SKIP",
          action: (expanded[i] && (expanded[i].action?.type || expanded[i].action?.use)) || "",
          detail: "no commands",
        });
        continue;
      }
      const res = runAgentBrowser(strings, true);
      if (agentBrowserMissing(res)) exitAgentBrowserMissing(missingCtx);
      const errText = scrubNoise(
        res.error ? String(res.error.message || res.error) : res.stderr || res.stdout || ""
      );
      const ok = !res.error && res.status === 0;
      stepResults.push({
        id: p.step_id,
        status: ok ? "PASS" : "FAIL",
        action: (expanded[i] && (expanded[i].action?.type || expanded[i].action?.use)) || "",
        detail: ok ? "" : errText.slice(0, 500),
      });
      if (!ok) {
        status = "FAIL";
        if (errText) errors.push(`step ${p.step_id}:\n${errText.slice(0, 1500)}`);
        // continue remaining steps (no-bail semantics)
      }
    }
  } else {
    // Default: single batch --bail (fast path)
    const batchArgs = [];
    for (const p of plan) {
      for (const cmd of p.commands) batchArgs.push(cmdToBatchString(cmd));
    }
    const res = runAgentBrowser(batchArgs, true);
    if (agentBrowserMissing(res)) exitAgentBrowserMissing(missingCtx);
    const rawErr = res.error
      ? String(res.error.message || res.error)
      : res.status !== 0
        ? res.stderr || res.stdout || `exit ${res.status}`
        : "";
    const errText = scrubNoise(rawErr);
    if (res.error || res.status !== 0) {
      status = "FAIL";
      if (errText) errors.push(errText.slice(0, 2000));
    }
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const ok = status === "PASS";
      stepResults.push({
        id: p.step_id,
        status: ok ? "PASS" : "SKIP",
        action: (expanded[i] && (expanded[i].action?.type || expanded[i].action?.use)) || "",
        detail: "",
      });
    }
    if (status !== "PASS" && stepResults.length) {
      stepResults[stepResults.length - 1].status = "FAIL";
    }
  }

  const ended = new Date().toISOString();

  // Light post checks: console on failure
  if (status !== "PASS") {
    try {
      const c = spawnSync("agent-browser", [...browser.flags, "console"], {
        env: browser.env,
        encoding: "utf8",
      });
      const cons = scrubNoise(c.stdout || "");
      if (cons) errors.push("console:\n" + cons.slice(0, 1500));
    } catch {
      /* ignore */
    }
  }

  errors = errors.map(scrubNoise).filter(Boolean);

  const evidence = {
    run_id: rid,
    workflow: workflowId,
    workflow_path: path.relative(projectRoot, wfPath),
    status,
    started_at: started,
    ended_at: ended,
    session: browser.session,
    session_explainer: browser.raw && browser.raw.session_explainer,
    no_bail: !!args.noBail,
    plan,
    steps: stepResults,
    unknown_actions: [],
    errors,
    expect_failures: expectFailures,
    batch_command_count: plan.reduce((n, p) => n + (p.commands || []).length, 0),
  };
  writeEvidence(runDir, evidence);

  console.log(
    JSON.stringify(
      {
        ok: status === "PASS",
        status,
        run_id: rid,
        evidence: path.join(runDir, "evidence.json"),
        report: path.join(runDir, "report.md"),
        session: browser.session,
        no_bail: !!args.noBail,
      },
      null,
      2
    )
  );
  process.exit(status === "PASS" ? 0 : 1);
}

main();
