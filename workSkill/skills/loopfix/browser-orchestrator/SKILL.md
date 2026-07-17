---
name: browser-orchestrator
description: "LoopFix browser orchestration: load workflow → resolve Action → batch official agent-browser → Evidence. Not a browser driver. Triggers: run workflow, execute workflow, orchestrate browser, browser-orchestrator, batch browser flow, 执行工作流, 跑 workflow, 编排浏览器. LLM must NOT click step-by-step. Calls agent-browser only."
argument-hint: "<workflow-id|path> [--cwd <project>] [--dry-run] [--base-url <url>] [--no-bail]"
allowed-tools:
  - Bash(node **/skills/loopfix/browser-orchestrator/scripts/*)
  - Bash(node **/skills/loopfix/loopfix/scripts/*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
  - Read(**/.loopfix/**)
  - Write(**/.loopfix/runs/**)
  - Write(**/.loopfix/browser/**)
---

# Browser Orchestrator

IRON LAW: **LLM picks workflow id. This skill executes. Never step-click in chat.**

Catalog: `skills/loopfix/` — install with sibling `loopfix` via:

```bash
npx skills add <owner/repo>/skills/loopfix --skill '*'
```

Atoms = official `agent-browser` only — `references/agent-browser-dependency.md`.

## Parameters

| Param | Meaning |
|-------|---------|
| `<workflow-id\|path>` | From `browser/workflows/index.yaml` or file path |
| `--cwd <project>` | Project with `.loopfix/` |
| `--dry-run` | Plan only |
| `--no-bail` | Run step-by-step; keep per-step PASS/FAIL (SPA / mask debug) |

## Workflow

```
- [ ] Step 0: check_agent_browser + session ⛔
- [ ] Step 1–2: run_workflow.js (load + resolve) ⛔
- [ ] Step 3: UNKNOWN_ACTION → ask user ⚠️
- [ ] Step 4: batch execute → Evidence
- [ ] Step 5: return status to loopfix
```

## Step 0 ⛔

```bash
node <this_skill>/scripts/check_agent_browser.js
```

Missing → stop; install per `references/agent-browser-dependency.md`.  
Session: `run_workflow.js` calls loopfix `browser_env.js` (sticky `--session --restore`).

## Step 1–4

```bash
node <this_skill>/scripts/run_workflow.js <workflow-id> --cwd <project> [--dry-run] [--base-url <url>] [--no-bail]
```

Script: load workflow → expand Action → `agent-browser batch` → write `.loopfix/runs/<id>/`.  
Schemas when editing: `workflow-schema.md`, `action-schema.md`, `evidence-schema.md`.  
`UNKNOWN_ACTION` → ask → write `.loopfix/browser/actions/` → re-run. No eval/guess/skip.

## Step 5

Return `status`, `run_id`, `evidence` path, `unknown_actions[]`.  
loopfix owns Failure Router / repair.

## Anti-Patterns / Pre-Delivery

- Chat click loops; CSS nth-child in workflows; `close --all`; dump all yaml into context
- [ ] Used `run_workflow.js`; Evidence written; UNKNOWN stopped for teach; no agent-browser skill edits
