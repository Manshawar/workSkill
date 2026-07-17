---
name: loopfix
description: "AI engineering quality loop after coding: select Flow Probe → headed agent-browser → Evidence → repair → Knowledge. Not a test framework / not E2E substitute / not per-component clicker. Triggers: validate, verify, check, regression, loopfix, init .loopfix, 验证, 检查, 回归, 帮我验证 URL. Flow PASS ≠ step success. Probe = pre-exec contract. Project UI knowledge stays in .loopfix/knowledge/ — never in this skill."
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

**What this is:** AI-coding → real browser validation → Evidence → fix → reusable engineering memory.  
**What this is NOT:** test framework, E2E suite, component auto-clicker.

IRON LAW:
1. **No browser without Flow Probe on disk** (except `--explore`).
2. **Step success ≠ Flow PASS.** Flow PASS only per rules below.
3. **No PASS without headed Evidence.** No fix without Evidence root cause.
4. **UNKNOWN_INTERACTION → ask user.** Never eval-placeholder / guess-click / silent skip.
5. **Skill = generic rules only.** Project component behavior → `.loopfix/knowledge/` / `browser/actions/`. Never bake project widgets into this skill.

Red Flags:
- Announce PASS after one step (input ok / button exists / API 2xx)
- Browser before Probe file
- Probe YAML written only after exploring
- One Probe per button/dialog
- Load all Probe YAMLs into context
- Write "How to click XWidget" into this skill

## Architecture

```
Code change
 → Knowledge lookup
 → Select flow id (from browser/index.yaml only)
 → Load one Flow Probe → expand Actions
 → agent-browser execute
 → Evidence (step + flow results)
 → Analyze (collect all issues; don't abort at first)
 → Repair → re-run same Probe
 → Update Probe / Actions / Knowledge
```

Layers:

```
Flow Probe  →  Reusable Action  →  agent-browser command
```

Token rule: **LLM selects; runtime executes.** Read `index.yaml` first — never dump entire `probes/` + `actions/` into context.

## Flow PASS (mandatory)

Distinguish:

| Level | Meaning |
|-------|---------|
| Step Result | One step ok/fail/skip/unknown |
| Flow Result | Whole behavior loop outcome |

**Flow PASS** requires ALL of:

```
last_executed_step_id == last_step_id
AND every expect satisfied
AND no UNKNOWN_INTERACTION unresolved
AND no unresolved exceptions (console/network/app errors that block the goal)
```

Otherwise **not PASS**. Use:

| Flow Result | When |
|-------------|------|
| `PASS` | All conditions above |
| `FAIL` | Goal broken / expect failed / blocking exception |
| `INCOMPLETE` | Mid-stop, skipped steps, guess ops, placeholders, early exit |

Mid-run: **continue the flow** when possible; record every issue in Evidence. Do not treat first glitch as Flow PASS/FAIL alone.

## UNKNOWN_INTERACTION

When unsure how to operate a control:

**Forbidden:** `eval` placeholders, guess clicks, random fills, silent skip.

**Required:** halt that interaction as `UNKNOWN_INTERACTION`, ask user:

1. How to open / enter  
2. How to select / input  
3. How to confirm  
4. What success looks like  

Then persist answer as project **Action** (`.loopfix/browser/actions/`) and/or **Knowledge** (`.loopfix/knowledge/components/`). Never into this skill.

## Probe Lifecycle

Contract **before** execute — not a recording after.

`draft` → `ready` → `verified` → `deprecated`

| Status | Rule |
|--------|------|
| `draft` | Incomplete OK; **not** formal verification PASS candidate |
| `ready` | Every step has real action (or explicit `skip_reason` + `skip_needs`); no eval placeholders; no unknown ops pretended done |
| `verified` | Full Flow PASS + complete Evidence once |
| `deprecated` | Do not reuse |

Schemas: `references/probe-format.md`, `references/action-format.md`, `references/registry-format.md`.

## Parameters

| Param | Default | Meaning |
|-------|---------|---------|
| `<url\|path>` | required* | Target (*omit if `--init-only`) |
| `--full` | yes | Full user-behavior loop |
| `--targeted` | — | Named loop only |
| `--init-only` | — | Scaffold `.loopfix/` only |
| `--no-fix` | — | No app code changes |
| `--quick` | — | Skip confirm gate |
| `--explore` | — | Browser w/o Probe; must write draft before reuse claims |

## Workflow

```
Loopfix Progress:

- [ ] Step 0: Parse target ⛔ BLOCKING
- [ ] Step 1: Ensure .loopfix/ ⛔ BLOCKING
- [ ] Step 2: Knowledge lookup + Scope
- [ ] Step 3: Select/create Flow Probe ⛔ BLOCKING
- [ ] Step 4: Confirm plan ⚠️ REQUIRED (skip if --quick)
- [ ] Step 5: Execute → Evidence ⚠️ REQUIRED
- [ ] Step 6: Analyze (Flow Result)
- [ ] Step 7: Fix + re-run (conditional)
- [ ] Step 8: Promote Probe/Actions + Knowledge
- [ ] Step 9: Report Flow Result
```

## Step 0: Parse target ⛔ BLOCKING

Parse `$ARGUMENTS`: URL/path, scope, flags. No target + not `--init-only` → ask.

## Step 1: Ensure `.loopfix/` ⛔ BLOCKING

```bash
node <skill_dir>/scripts/init_loopfix.js
```

Scaffold includes `browser/index.yaml`, `probes/`, `actions/`, `knowledge/{drafts,components,patterns,flows}/`, `runs/`.

## Step 2: Knowledge lookup + Scope

1. Read relevant `.loopfix/knowledge/{components,patterns,flows,drafts}/` **by need** — not whole tree
2. Scope → `references/validation-scope.md`
3. Ask: success = **business goal done**, not step cosmetics
4. Ask: which **user-behavior loop**?

## Step 3: Select/create Flow Probe ⛔ BLOCKING

1. Load **only** `.loopfix/browser/index.yaml` → pick `flow id`
2. Load **that** Probe path (+ referenced Actions only)
3. Prefer `verified` > `ready` > `draft`
4. No match → AI writes Flow Probe `draft` + index entry **now**
5. Gate: Probe file on disk before leave

Reuse vs new → `references/probe-format.md` (behavior loop, not URL/button).

## Step 4: Confirm plan ⚠️ REQUIRED

Unless `--quick`:

- URL, scope
- `flow id` + Probe path + `status`
- `steps` count / `expect` count
- Action refs count (if any)
- New vs reuse
- Fixes allowed?

No browser until confirm (`--quick` exempt) **and** Probe exists (unless `--explore`).

## Step 5: Execute → Evidence ⚠️ REQUIRED

Preflight: Probe on disk or `--explore`.

```bash
agent-browser open <url> --headed
```

`agent-browser skills get core` as needed. Project: `.loopfix/references/agent-browser.md`.

Execute expanded Probe (inline `action:` / `ref:`). Perception: snapshot default; screenshot sparse → `references/evidence-format.md`.

On unknown control → UNKNOWN_INTERACTION (ask; do not fake).

Continue through flow when safe; log all step results. Write:

```
.loopfix/runs/<YYYY-MM-DD>-<slug>/
  evidence.json
  screenshot/
  report.md
```

## Step 6: Analyze (Flow Result)

Compute Flow Result (`PASS` | `FAIL` | `INCOMPLETE`) from Evidence — not from vibes.

Ask: step fails vs flow incomplete? App bug vs missing Action vs stale Probe?

## Step 7: Fix + re-run (conditional)

App-code root cause + not `--no-fix` → minimal fix (`references/repair-principles.md`) → **same Probe** Step 5.

Missing Action/Knowledge → write project files, then re-run.

## Step 8: Promote + Knowledge

1. Refine Probe/Actions from real run
2. Flow PASS → Probe `verified` (`draft` never claims formal PASS)
3. Knowledge → `references/knowledge-rules.md` (`components/` / `patterns/` / `flows/`)
4. Update `browser/index.yaml` if new/changed flow

## Step 9: Report

1. **Flow Result** (PASS/FAIL/INCOMPLETE) — never imply PASS if INCOMPLETE
2. Probe path + status before→after
3. Evidence path + `halted_at` if any
4. Issues found (may be many)
5. Fixes / Actions / Knowledge written

## Anti-Patterns

- Step success sold as Flow PASS
- Stop at first issue and declare done
- Guess / eval / skip unknown widgets
- Probe-per-button catalog
- Load all YAMLs into LLM
- Project widget recipes inside this skill
- Lazy Probe persistence after explore
- Screenshot spam

## Pre-Delivery Checklist

- [ ] Flow Result computed with PASS rules (last step + expects + no UNKNOWN + no unresolved blockers)
- [ ] INCOMPLETE used when mid-stop / skip / guess
- [ ] Probe existed before browser (or `--explore` + draft before reuse)
- [ ] Selected via `index.yaml`; only needed Probe/Actions loaded
- [ ] Project knowledge in `.loopfix/`, not skill
- [ ] Evidence has step results + flow result + halted_at if halted
- [ ] Headed agent-browser; sparse screenshots
