---
name: loopfix
description: "AI engineering quality loop after coding: select Flow Probe/workflow → browser-orchestrator batch exec → Evidence → Failure Router → repair app → Knowledge. Not test framework/E2E/click-robot. Triggers: validate, verify, check, regression, test page, test flow, validate page, verify flow, loopfix, init .loopfix, 验证, 检查, 回归, 帮我验证 URL, 验证这个页面, 检查这个功能, 回归测试. LLM selects workflow only — never step-clicks. Fail: network→console→state→dom→action last. Project UI knowledge in .loopfix/ only."
argument-hint: "<url|path> [--full|--targeted] [--init-only] [--no-fix] [--quick] [--explore]"
allowed-tools:
  - Bash(node **/loopfix/loopfix/scripts/*)
  - Bash(node **/loopfix/browser-orchestrator/scripts/*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
  - Read(**/.loopfix/**)
  - Write(**/.loopfix/**)
  - Edit(**/.loopfix/**)
---

# Loopfix

**Suite layout** (same category, install both):

```
loopfix/
├── loopfix/                 ← this skill (validation loop)
└── browser-orchestrator/    ← workflow execution (+ agent-browser check)
```

**Depends on official `agent-browser` skill + CLI** (global). Do not fork agent-browser.

**Is:** AI-coding → real validation → Evidence → attribute → fix → memory.  
**Not:** test framework, E2E suite, step-click robot.

IRON LAW:
1. **No browser without Flow Probe on disk** (except `--explore`).
2. **Step success ≠ Flow PASS.**
3. **Known → browser-orchestrator Replay. Unknown → UNKNOWN_ACTION + ask.** Never guess/eval/skip.
4. **Fail → Failure Router before any Action edit.** Debug: network → console → state → dom → action (last).
5. **agent-browser observes/executes — not default fix target.** Prefer app/API bugs.
6. **Skill = generic only.** Project widgets → `.loopfix/browser/actions` + `knowledge/`.
7. **Sticky browser session.** Always `--session` + `--restore` (via `browser_env.js`). Never cold-open; never `close --all` on project session.

Red Flags:
- fill→snapshot→analyze every field
- Re-explore when Action exists
- PASS on single step / API 2xx alone
- Sleep/skip/drop-expect to force green
- Tweak Action before network/console/state
- Probe as click/snapshot log

## Three loops

```
Capability:  unknown → Action → reuse
Validation:  Probe → browser-orchestrator → Evidence
Repair:      Fail → Attribution → code fix → re-verify
```

## Architecture

```
loopfix (why)
  → select Probe / workflow id
  → browser-orchestrator (how): run_workflow.js
       → resolve Action
       → agent-browser batch (atoms)
  → Evidence
  → Failure Router → Repair → re-run orchestrator
```

Layers: `Probe → Workflow → Action → agent-browser`.  
**LLM never step-clicks.** Select workflow; orchestrator executes.

## Flow PASS

```
last_executed_step_id == last_step_id
AND all expect pass
AND no unresolved UNKNOWN_INTERACTION
AND no unresolved blocking exceptions
```

| Result | When |
|--------|------|
| `PASS` | All above |
| `FAIL` | Goal/expect/blocker |
| `INCOMPLETE` | Mid-stop, skip, guess, placeholder |

## Parameters

| Param | Default | Meaning |
|-------|---------|---------|
| `<url\|path>` | required* | Target |
| `--full` / `--targeted` | full | Scope |
| `--init-only` | — | Scaffold only |
| `--no-fix` | — | No app edits |
| `--quick` | — | Skip confirm gates |
| `--explore` | — | No Probe gate; draft before reuse claims |

## Workflow

```
- [ ] Step 0: Parse target ⛔
- [ ] Step 1: Ensure .loopfix/ ⛔
- [ ] Step 2: Knowledge + Scope
- [ ] Step 3: Select/create Flow Probe ⛔
- [ ] Step 4: Confirm ⚠️ (skip if --quick)
- [ ] Step 5: browser-orchestrator execute → Evidence ⚠️
- [ ] Step 6: Flow Result + Failure Router
- [ ] Step 7: Repair + re-run ⚠️
- [ ] Step 8: Promote + Knowledge
- [ ] Step 9: Report
```

## Step 0–1

Parse args.

**Before any browser work** ⛔:

```bash
node <suite>/browser-orchestrator/scripts/check_agent_browser.js
# missing → stop; tell user:
#   npx skills add vercel-labs/agent-browser
#   npm install -g agent-browser
#   agent-browser install
```

Init project: `node <loopfix_skill>/scripts/init_loopfix.js`  
(`<loopfix_skill>` = `loopfix/loopfix/` in suite)

## Step 2: Knowledge + Scope

Need-based read under `knowledge/`.  
Load `references/validation-scope.md`. Success = business goal.

## Step 3: Flow Probe ⛔

Load `references/probe-format.md` + `references/registry-format.md`.

1. `browser/index.yaml` → pick flow id  
2. Load **that** Probe only; prefer verified > ready > draft  
3. No match → write draft Probe + index entry **now**  
4. Gate: Probe file on disk before leave

## Step 4: Confirm ⚠️

Unless `--quick`: flow id, path, status, phase counts, Action refs, fixes allowed.  
No browser until confirm + Probe (unless `--explore`).

## Step 5: Execute via browser-orchestrator → Evidence ⚠️

**Do not** drive the browser click-by-click in chat. Delegate:

```bash
node <suite>/browser-orchestrator/scripts/run_workflow.js <workflow-id> --cwd <project> --dry-run
node <suite>/browser-orchestrator/scripts/run_workflow.js <workflow-id> --cwd <project> [--base-url <url>]
```

`<suite>` = parent dir containing `loopfix/` + `browser-orchestrator/`.

Session sticky is handled inside `run_workflow.js` via loopfix `browser_env.js`.

| Script status | loopfix next |
|---------------|----------------|
| `PASS` | Step 6 (may still Failure-Router edge cases) |
| `FAIL` | Step 6 Failure Router on Evidence |
| `UNKNOWN_ACTION` | Ask user → write `.loopfix/browser/actions/` → re-run script |

Load `references/evidence-format.md` when merging orchestrator Evidence into Flow Result.  
Ad-hoc `agent-browser console/network` **only** inside Failure Router (Step 6) — not for walking the happy path.

**Ban:** bare step-click loops; `close --all` on shared session.

## Step 6: Flow Result + Failure Router

Compute PASS/FAIL/INCOMPLETE.  
If not PASS → load `references/failure-router.md`; fill `verdict`/`category`/`reason`/`suggestion`/`debug_order_checked`.  
No Action edit unless `ACTION_ERROR` or `BROWSER_ERROR`.

## Step 7: Repair + re-run ⚠️

Load `references/repair-principles.md`.

| Category | Do |
|----------|-----|
| `APPLICATION_ERROR` / `API_ERROR` | Unless `--no-fix`: list files + reason; **confirm** (skip if `--quick`); fix app/API; re-run Probe |
| `ACTION_ERROR` / `BROWSER_ERROR` | Fix Action/env; re-run |
| `UNKNOWN` | More Evidence / ask — no blind Action patch |

Ban sleep-to-pass / drop expects / skip broken business step in scripts.

## Step 8: Promote + Knowledge

Load `references/knowledge-rules.md`.  
Refine Probe/Actions; Flow PASS → `verified`; patterns → `knowledge/patterns/`; update index.

## Step 9: Report

Flow Result + verdict/category/reason + Evidence path + fix target (app vs action) + Knowledge paths.

## Anti-Patterns

- Click robot / snapshot every step (use browser-orchestrator)
- Re-explore known Action
- Hang/loading-stuck blamed on "browser slow" first
- Patch Action to hide app bug
- Step PASS as Flow PASS
- Project recipes in skill
- Lazy Probe after explore
- Cold `open` without session/restore (forces re-login)
- `close --all` killing shared project session

## Pre-Delivery Checklist

- [ ] Execution via `run_workflow.js` — not manual click loop
- [ ] Flow Result honest (INCOMPLETE when mid-stop)
- [ ] FAIL/INCOMPLETE has Failure Router category; debug order ok
- [ ] No Action edit on APPLICATION/API without confirm/override
- [ ] UNKNOWN_ACTION → project Action file, not skill
- [ ] No sleep/skip/drop-expect to force green
- [ ] Headed + restore session; sparse screenshots
- [ ] Did not `close --all` on project session
