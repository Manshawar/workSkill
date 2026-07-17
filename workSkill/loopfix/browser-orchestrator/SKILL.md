---
name: browser-orchestrator
description: "LoopFix browser orchestration layer: load workflow → resolve Action → batch-call official agent-browser → Evidence. Not a browser driver. Triggers: run workflow, execute workflow, orchestrate browser, browser-orchestrator, batch browser flow, 执行工作流, 跑 workflow, 编排浏览器. Use when LLM must NOT click step-by-step. Calls agent-browser only; never reimplements click/fill/snapshot."
argument-hint: "<workflow-id|path> [--cwd <project>] [--dry-run] [--base-url <url>]"
allowed-tools:
  - Bash(node **/loopfix/browser-orchestrator/scripts/*)
  - Bash(node **/loopfix/loopfix/scripts/*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
  - Read(**/.loopfix/**)
  - Write(**/.loopfix/runs/**)
  - Write(**/.loopfix/browser/**)
---

# Browser Orchestrator

**Suite layout:**

```
loopfix/
├── loopfix/                 ← validation loop (caller)
└── browser-orchestrator/    ← this skill (exec + CLI check)
```

**Requires official `agent-browser`** (skill + CLI). Not bundled here.  
See `references/agent-browser-dependency.md`.

IRON LAW: **LLM selects workflow id. Orchestrator executes. Never click/fill/snapshot one-by-one in the chat.**

Red Flags:
- LLM `agent-browser click` between analyses
- Reimplementing browser ops inside this skill
- Editing official agent-browser skill
- Writing project widget recipes into this skill (→ `.loopfix/browser/actions/`)
- Pretending PASS when Action missing (must `UNKNOWN_ACTION`)

## Layer map

```
loopfix / validation-loop     → why validate, Failure Router, Knowledge
        ↓
browser-orchestrator (this)  → workflow / action resolve / batch exec / Evidence
        ↓
agent-browser (official)     → open/click/fill/snapshot/console/network
        ↓
Browser
```

Do **not** modify agent-browser. Do **not** copy it. Call it.

## Parameters

| Param | Meaning |
|-------|---------|
| `<workflow-id\|path>` | id from `browser/workflows/index.yaml` or path to workflow file |
| `--cwd <project>` | Project root containing `.loopfix/` |
| `--dry-run` | Resolve + print plan; no browser |
| `--base-url <url>` | Override workflow base_url |

## Workflow

```
Browser Orchestrator Progress:

- [ ] Step 0: agent-browser installed ⛔ + sticky session ⛔
- [ ] Step 1: Load workflow (id → file) ⛔
- [ ] Step 2: Resolve Actions → command plan ⛔
- [ ] Step 3: Confirm if UNKNOWN_ACTION / empty plan ⚠️
- [ ] Step 4: Execute via agent-browser (batch) ⚠️
- [ ] Step 5: Write Evidence under .loopfix/runs/
- [ ] Step 6: Return status to caller (PASS|FAIL|UNKNOWN_ACTION|INCOMPLETE)
```

## Step 0: agent-browser + session ⛔

**CLI check** (real run; `run_workflow.js` also checks):

```bash
node <this_skill>/scripts/check_agent_browser.js
```

If missing, stop and ask user to run:

```bash
npx skills add vercel-labs/agent-browser
npm install -g agent-browser
agent-browser install
```

Session (via loopfix `browser_env.js` inside `run_workflow.js`):

```bash
eval $(node <suite>/loopfix/scripts/browser_env.js --cwd <project> --export)
```

Same session across chats — no re-login.

## Step 1–2: Load + resolve ⛔

```bash
node <skill_dir>/scripts/run_workflow.js <workflow-id> --cwd <project> [--dry-run] [--base-url <url>]
```

Script:
1. Reads `.loopfix/browser/workflows/` (+ index)
2. Expands `action.use` from `.loopfix/browser/actions/`
3. Emits agent-browser command list
4. On missing Action → exit `UNKNOWN_ACTION` (no guess/eval)

Schemas: load when editing files — `references/workflow-schema.md`, `references/action-schema.md`.

## Step 3: UNKNOWN_ACTION ⚠️

If script returns `UNKNOWN_ACTION`:
- Stop. Ask user how to operate the control.
- Persist to `.loopfix/browser/actions/` (project). **Not** this skill.
- Re-run workflow.

## Step 4: Execute ⚠️

Script runs `agent-browser batch` (or sequential with same `--session`) with sticky flags.  
LLM does **not** interleave analysis between clicks.

Checkpoints: snapshot only where workflow says `snapshot` / phase verify — not every step.

## Step 5: Evidence

Writes `.loopfix/runs/<run-id>/` — schema `references/evidence-schema.md`.

## Step 6: Return to loopfix

Hand back: `status`, `run_id`, `evidence` path, `unknown_actions[]`.  
Caller (loopfix) does Failure Router / repair — not this skill.

## Anti-Patterns

- Step-by-step LLM browser driving
- CSS nth-child hardcoding in workflows (use Action abstractions)
- `eval` to fake unknown widgets
- `close --all` on shared session
- Dumping all workflows into LLM context — select by id/index only

## Pre-Delivery Checklist

- [ ] Used `run_workflow.js` (or dry-run then run) — not manual click loop
- [ ] Official agent-browser only for atoms
- [ ] Evidence written
- [ ] UNKNOWN_ACTION stopped for user teach → project Action
- [ ] No edits to agent-browser skill
