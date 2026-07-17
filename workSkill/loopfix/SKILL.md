---
name: loopfix
description: "AI engineering quality loop after coding: select Flow Probe → page analyze → batch Actions → Evidence → Failure Router → repair app (not scripts) → Knowledge. Not test framework/E2E/click-robot. Triggers: validate, verify, check, regression, test page, test flow, validate page, verify flow, loopfix, init .loopfix, 验证, 检查, 回归, 帮我验证 URL, 验证这个页面, 检查这个功能, 回归测试. Known→Replay/batch; unknown→Exploration+ask. Fail: network→console→state→dom→action last. Project UI knowledge in .loopfix/ only."
argument-hint: "<url|path> [--full|--targeted] [--init-only] [--no-fix] [--quick] [--explore]"
allowed-tools:
  - Bash(node **/loopfix/scripts/*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
  - Read(**/.loopfix/**)
  - Write(**/.loopfix/**)
  - Edit(**/.loopfix/**)
---

# Loopfix

**Is:** AI-coding → real validation → Evidence → attribute → fix → memory.  
**Not:** test framework, E2E suite, step-click robot.

IRON LAW:
1. **No browser without Flow Probe on disk** (except `--explore`).
2. **Step success ≠ Flow PASS.**
3. **Known → Replay/batch. Unknown → Exploration + ask.** Never guess/eval/skip.
4. **Fail → Failure Router before any Action edit.** Debug: network → console → state → dom → action (last).
5. **agent-browser observes/executes — not default fix target.** Prefer app/API bugs.
6. **Skill = generic only.** Project widgets → `.loopfix/browser/actions` + `knowledge/`.

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
Validation:  Probe → agent-browser → Evidence
Repair:      Fail → Attribution → code fix → re-verify
```

## Architecture

```
index.yaml → one Probe (+ Actions)
 → Open → Analyze → Plan → Replay batch / Exploration
 → Evidence → Failure Router → Repair → re-run → Promote
```

Layers: `Probe → Action → agent-browser`. LLM selects/plans; batch executes; never dump all yaml.

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
- [ ] Step 5: Analyze → Plan → Execute → Evidence ⚠️
- [ ] Step 6: Flow Result + Failure Router
- [ ] Step 7: Repair + re-run ⚠️
- [ ] Step 8: Promote + Knowledge
- [ ] Step 9: Report
```

## Step 0–1

Parse args. Init: `node <skill_dir>/scripts/init_loopfix.js`.

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

## Step 5: Analyze → Plan → Execute → Evidence ⚠️

Load in order:
1. `references/execution-strategy.md`
2. `references/agent-browser-cli.md`
3. `references/evidence-format.md` (before writing Evidence)
4. `references/action-format.md` — **only if** Probe has `use:`

```bash
agent-browser open <url> --headed
agent-browser snapshot -i --json
```

Follow execution-strategy (Analyze → Plan → batch/explore → Evidence).  
Version-matched extras: `agent-browser skills get core`.  
**No Action/code edits here** — attribution is Step 6.

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

- Click robot / snapshot every step
- Re-explore known Action
- Hang/loading-stuck blamed on "browser slow" first
- Patch Action to hide app bug
- Step PASS as Flow PASS
- Project recipes in skill
- Lazy Probe after explore

## Pre-Delivery Checklist

- [ ] Page Schema + plan before batch
- [ ] Replay for known; Exploration only for unknown
- [ ] Flow Result honest (INCOMPLETE when mid-stop)
- [ ] FAIL/INCOMPLETE has Failure Router category; debug order ok
- [ ] No Action edit on APPLICATION/API without confirm/override
- [ ] No sleep/skip/drop-expect to force green
- [ ] Probe = phases/Actions, not click log
- [ ] Headed; sparse screenshots
