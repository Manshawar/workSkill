---
name: loopfix
description: "AI engineering loop: validate URL/page/flow with real browser → fix → persist Probe/Knowledge. Triggers: validate, verify, check, regression, test page/flow, loopfix, init .loopfix, 验证, 检查, 回归, 帮我验证 URL, 验证这个页面, 检查这个功能. Targets: URL, localhost, file path, route, page, probe. Default: init .loopfix if missing, then one headed agent-browser run."
argument-hint: "<url|path> [--full|--targeted] [--init-only] [--no-fix] [--quick]"
allowed-tools:
  - Bash(node **/loopfix/scripts/*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
  - Read(**/.loopfix/**)
  - Write(**/.loopfix/**)
  - Edit(**/.loopfix/**)
---

# Loopfix

IRON LAW: **No PASS without headed agent-browser Evidence. No fix without Evidence root cause.**

Red Flags (return to Step 5):
- Claiming "looks fine" from code read alone
- Headless validation (debugging needs a visible window)
- Fix without naming which Evidence pointed to the bug
- Skipping Evidence / Probe / Knowledge persistence

## Parameters

| Param | Default | Meaning |
|-------|---------|---------|
| `<url\|path>` | required* | Target URL or local file/route hint (*omit with `--init-only`) |
| `--full` | yes | Full Flow: enter/search/create/edit/delete/paginate/filter |
| `--targeted` | — | Only the flow the user named |
| `--init-only` | — | Create `.loopfix/` only; no validation |
| `--no-fix` | — | Validate + report; do not change app code |
| `--quick` | — | Skip confirmation gate |

## Workflow

```
Loopfix Progress:

- [ ] Step 0: Parse target ⛔ BLOCKING
- [ ] Step 1: Ensure .loopfix/ ⛔ BLOCKING
- [ ] Step 2: Knowledge lookup + Scope
- [ ] Step 3: Resolve Probe
- [ ] Step 4: Confirm plan ⚠️ REQUIRED (skip if --quick)
- [ ] Step 5: Headed agent-browser → Evidence ⚠️ REQUIRED
- [ ] Step 6: Analyze Evidence
- [ ] Step 7: Fix + re-validate (skip if --no-fix or PASS)
- [ ] Step 8: Persist Probe + Knowledge Draft
- [ ] Step 9: Report
```

## Step 0: Parse target ⛔ BLOCKING

From `$ARGUMENTS`:

1. Target: URL (`http(s)://` / `localhost`) or file path / route description?
2. Scope: `--targeted` → Targeted; else Full Flow
3. Flags: `--init-only` / `--no-fix` / `--quick`?

Ask: if no URL/path and not `--init-only`, stop and ask for target.

File path: read file → infer page/route → resolve openable URL (ask for base URL if missing).

## Step 1: Ensure `.loopfix/` ⛔ BLOCKING

At **project root** (app git root, not this skill repo):

```bash
node <skill_dir>/scripts/init_loopfix.js
# complete → status ready, no overwrite
# missing → scaffold from assets/
```

`<skill_dir>` = directory of this SKILL.md.

Scaffold: config, agent-browser ref, thin validation-loop entry, empty probes/drafts/runs.

Overwrite existing files only after user confirm. Never silent overwrite.

`--init-only` → print path summary and stop.

## Step 2: Knowledge lookup + Scope

1. Scan `.loopfix/knowledge/drafts/` (and future `rules/` / `patterns/`) for related drafts
2. Decide scope → load `references/validation-scope.md`
3. Ask: what does success look like? (key UI state, no console errors, 2xx APIs, …)

## Step 3: Resolve Probe

1. Search `.loopfix/browser/probes/` for reusable Probe
2. Match → reuse; do not re-explore the same flow
3. No match → draft per `references/probe-format.md` (persist after PASS)

Probe = browser actions only. No analysis. No fix plan.

## Step 4: Confirm plan ⚠️ REQUIRED

Unless `--quick`, confirm:

- Target URL / how it was derived
- Scope: Full or Targeted
- Probe (existing name or new summary)
- Fixes allowed? (default yes; no if `--no-fix`)

⚠️ Do not open the browser until confirmed (`--quick` exempt).

## Step 5: Headed agent-browser → Evidence ⚠️ REQUIRED

**Only** browser layer: agent-browser. This skill schedules; it does not reimplement browsing.

```bash
agent-browser open <url> --headed
```

Before ops: `agent-browser skills get core` (or `--full`).

Project conventions: load `.loopfix/references/agent-browser.md`.

Run Probe; collect Evidence into:

```
.loopfix/runs/<YYYY-MM-DD>-<slug>/
  evidence.json
  screenshot/
  report.md
```

Schema: `references/evidence-format.md`. **Evidence ≠ Knowledge** — facts only.

## Step 6: Analyze Evidence

Ask:

- Which steps failed? What do screenshot / console / network show?
- App bug, env issue, or stale Probe?
- One-sentence root cause? (none → block Step 7)

## Step 7: Fix + re-validate (conditional)

When: failures in Step 6 **and** not `--no-fix` **and** root cause in app code.

Rules → `references/repair-principles.md`:

- Minimal change to restore correct behavior
- No drive-by refactors / framework churn

Unless `--quick`: list files + reason; get approval.

After fix → **must** return to Step 5 with the same Probe. No "fixed" claim without re-run.

## Step 8: Persist Probe + Knowledge Draft

On PASS:

1. **Probe**: write/update `.loopfix/browser/probes/<name>.yaml`
2. **Knowledge Draft**: `.loopfix/knowledge/drafts/` per `references/knowledge-rules.md`  
   Ban page-level error notes (`user-page-error.md`). Abstract Rule / Pattern / Incident with cross-refs.

## Step 9: Report

1. Result: PASS / FAIL
2. Scope + Probe
3. Evidence path
4. Fix summary (if any)
5. Persistence: Probe name + Knowledge Draft path (or "none needed")

## Anti-Patterns

- Verbal PASS without Evidence
- Re-exploring a flow that already has a Probe
- Full scope but only clicking the changed control
- Dumping raw console text as Knowledge
- Drive-by refactors while fixing
- Replacing agent-browser with Playwright/Puppeteer/built-in browser tools
- Headless by default (unless user explicitly asks)
- Putting AI assets outside `.loopfix/`

## Pre-Delivery Checklist

- [ ] `.loopfix/` has config.yaml + skills/validation-loop + references/agent-browser.md
- [ ] Used `agent-browser ... --headed`
- [ ] `runs/<slug>/` has evidence.json + ≥1 screenshot + report.md
- [ ] FAIL+fixed → re-ran same Probe
- [ ] On PASS, considered Probe persist; Knowledge not page-level filename
- [ ] No Evidence-free "should be fine" claims
