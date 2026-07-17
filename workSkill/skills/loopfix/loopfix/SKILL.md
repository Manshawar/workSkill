---
name: loopfix
description: "AI engineering quality loop after coding: select Flow Probe/workflow → browser-orchestrator batch exec → Evidence → Failure Router → repair app → Knowledge. Not test framework/E2E/click-robot. Install suite: skills/loopfix (with browser-orchestrator). Triggers: validate, verify, check, regression, test page, test flow, validate page, verify flow, loopfix, init .loopfix, 验证, 检查, 回归, 帮我验证 URL, 验证这个页面, 检查这个功能, 回归测试. LLM selects workflow only — never step-clicks. Fail: network→console→state→dom→action last. Project UI knowledge in .loopfix/ only."
argument-hint: "<url|path> [--full|--targeted] [--init-only] [--no-fix] [--quick] [--explore]"
allowed-tools:
  - Bash(node **/skills/loopfix/loopfix/scripts/*)
  - Bash(node **/skills/loopfix/browser-orchestrator/scripts/*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
  - Read(**/.loopfix/**)
  - Write(**/.loopfix/**)
  - Edit(**/.loopfix/**)
---

# Loopfix

**Is:** AI-coding → validate → Evidence → attribute → fix → memory.  
**Not:** test framework / E2E / click-robot.  
**Catalog:** `skills/loopfix/{loopfix,browser-orchestrator}/`. Official `agent-browser` for atoms.

**Install suite (both skills):**

```bash
npx skills add <owner/repo>/skills/loopfix --skill '*'
# or interactive: select both loopfix + browser-orchestrator
```

IRON LAW:
1. No browser without Probe on disk (except `--explore`).
2. Step success ≠ Flow PASS.
3. Execute only via browser-orchestrator — never step-click in chat.
4. Fail → Failure Router before Action edits. Debug: network → console → state → dom → action last.
5. Prefer app/API fixes; agent-browser is observer, not default fix target.
6. Project widgets → `.loopfix/browser/actions` + `knowledge/` — never this skill.

## Architecture

```
Probe (why) → browser-orchestrator (how) → agent-browser (atoms) → Evidence
 → Failure Router → Repair → re-run orchestrator → Knowledge
```

**Flow PASS** = last step done AND all expects AND no UNKNOWN AND no unresolved blockers.  
Else `FAIL` or `INCOMPLETE` (mid-stop / skip / guess).

## Parameters

| Param | Default | Meaning |
|-------|---------|---------|
| `<url\|path>` | required* | Target |
| `--full` / `--targeted` | full | Scope |
| `--init-only` | — | Scaffold only |
| `--no-fix` | — | No app edits |
| `--quick` | — | Skip confirms |
| `--explore` | — | No Probe gate; draft before reuse |

## Workflow

```
- [ ] Step 0–1: Parse + init .loopfix/ ⛔
- [ ] Step 2: Knowledge + Scope
- [ ] Step 3: Select/create Flow Probe ⛔
- [ ] Step 4: Confirm ⚠️ (skip if --quick)
- [ ] Step 5: browser-orchestrator → Evidence ⚠️
- [ ] Step 6: Flow Result + Failure Router
- [ ] Step 7: Repair + re-run ⚠️
- [ ] Step 8: Promote + Knowledge
- [ ] Step 9: Report
```

## Step 0–1

```bash
node <suite>/loopfix/scripts/init_loopfix.js
# <suite> = skills/loopfix/
```

No agent-browser pre-check. If Step 5 returns `AGENT_BROWSER_MISSING`, relay JSON `install` to user (official skill + global CLI + `agent-browser install`).

## Step 2: Knowledge + Scope

Need-based `knowledge/` read. Load `references/validation-scope.md`. Success = business goal.

## Step 3: Flow Probe ⛔

Load `references/probe-format.md` + `references/registry-format.md`.  
First time: also load `references/probe-vs-workflow.md` (which dir / which keys).  
`browser/index.yaml` → one Probe (verified > partial > ready > draft). No match → write draft + index now. File on disk before leave.

## Step 4: Confirm ⚠️

Unless `--quick`: flow id, path, status, phase counts, fixes allowed. No browser until confirm + Probe.

## Step 5: Orchestrator ⚠️

```bash
node <suite>/browser-orchestrator/scripts/run_workflow.js <workflow-id> --cwd <project> [--dry-run] [--base-url <url>] [--no-bail]
```

- Default: `batch --bail` (fast). SPA + loading mask: add `wait.selector_gone` in workflow; use `--no-bail` to keep per-step PASS/FAIL when diagnosing.
- Dry-run writes Evidence with `status: DRY_RUN` + `plan`.

| Status | Next |
|--------|------|
| `PASS` | Step 6 |
| `FAIL` | Step 6 Failure Router |
| `UNKNOWN_ACTION` | Ask → `.loopfix/browser/actions/` → re-run |
| `AGENT_BROWSER_MISSING` | Relay `install` from JSON; retry after user installs |

Load `references/evidence-format.md` for attribution merge.  
Ad-hoc `agent-browser` only in Step 6 — load `references/agent-browser-cli.md`; sticky session via `browser_env.js` (see `.loopfix/references/agent-browser.md`).

## Step 6: Failure Router

Compute PASS/FAIL/INCOMPLETE.  
If not PASS → load `references/failure-router.md`. No Action edit unless `ACTION_ERROR` / `BROWSER_ERROR`.

## Step 7: Repair ⚠️

Load `references/repair-principles.md`.  
APPLICATION/API → confirm (unless `--quick`/`--no-fix`) → fix → re-run orchestrator.  
Ban sleep-to-pass / drop expects.

## Step 8–9

Load `references/knowledge-rules.md`. Promote Probe `verified`; patterns → `knowledge/patterns/`.  
Report: Flow Result + category/reason + Evidence path + fix target + Knowledge paths.

## Anti-Patterns / Pre-Delivery

- Step-click; Action-first on app bugs; Step PASS as Flow PASS; recipes in skill; `close --all`
- [ ] Ran `run_workflow.js` (not click loop)
- [ ] Honest Flow Result + Failure Router category when fail
- [ ] UNKNOWN_ACTION → project Action only
- [ ] No sleep/skip/drop-expect to force green
