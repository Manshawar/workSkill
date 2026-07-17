---
name: loopfix
description: "AI engineering loop: validate URL/page/flow with real browser → fix → persist Probe/Knowledge. Triggers: validate, verify, check, regression, test page/flow, loopfix, init .loopfix, 验证, 检查, 回归, 帮我验证 URL, 验证这个页面, 检查这个功能. Targets: URL, localhost, file path, route, page, probe. Default: init .loopfix if missing, then one headed agent-browser run. Probe is an executable contract written BEFORE browser ops."
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

IRON LAW:
1. **No browser execution without a Probe file on disk** (except `--explore`).
2. **No PASS without headed agent-browser Evidence.**
3. **No fix without Evidence root cause.**

Red Flags (abort / rewind):
- Operating the browser before `.loopfix/browser/probes/<name>.yaml` exists
- Writing Probe YAML only after clicking around ("lazy persistence")
- Claiming "looks fine" from code read alone
- Headless validation (unless user asks)
- Fix without naming which Evidence pointed to the bug
- One Probe per button / control (explode the catalog)

## Probe Lifecycle

Probe = **executable contract** ("how this validation should run"), not a post-hoc recording.

```
Define intent → Create Probe (draft on disk) → Execute Probe → Evidence → Refine Probe / Knowledge
```

Peers under a Flow (not parent/child):

```
Flow
 ├── Probe     → how to validate
 ├── Knowledge → what we learned
 └── (via execution)
      Evidence → what happened this run
```

Status machine (`status` field in YAML):

| Status | Meaning |
|--------|---------|
| `draft` | AI-generated intent; may be incomplete; **required before first run** |
| `ready` | Steps believed complete; not yet PASS-verified |
| `verified` | At least one PASS with Evidence; prefer for reuse |
| `deprecated` | Superseded; do not reuse |

Rules:

- **Before execute**: Probe file must exist (`draft` OK). AI writes the draft — humans need not author full YAML.
- **During execute**: follow the file; if steps missing, **update the Probe**, then continue — do not abandon the file.
- **After PASS**: promote to `verified` (or keep `ready` if intentionally partial); never leave a successful run with only an in-memory recipe.
- **Reuse vs new**: load `references/probe-format.md` (business-flow split + Flow/Sub Probe refs). Same URL ≠ same Probe if the user behavior loop differs.

`--explore`: rare escape hatch to browse without Probe; must end by writing a `draft` Probe before claiming any reusable result. Default workflows must NOT use `--explore`.

## Parameters

| Param | Default | Meaning |
|-------|---------|---------|
| `<url\|path>` | required* | Target URL or local file/route hint (*omit with `--init-only`) |
| `--full` | yes | Full Flow: enter/search/create/edit/delete/paginate/filter |
| `--targeted` | — | Only the flow the user named |
| `--init-only` | — | Create `.loopfix/` only; no validation |
| `--no-fix` | — | Validate + report; do not change app code |
| `--quick` | — | Skip confirmation gate |
| `--explore` | — | Allow browser without Probe (must still write draft before reuse claims) |

## Workflow

```
Loopfix Progress:

- [ ] Step 0: Parse target ⛔ BLOCKING
- [ ] Step 1: Ensure .loopfix/ ⛔ BLOCKING
- [ ] Step 2: Knowledge lookup + Scope
- [ ] Step 3: Resolve Probe on disk ⛔ BLOCKING
- [ ] Step 4: Confirm plan ⚠️ REQUIRED (skip if --quick)
- [ ] Step 5: Execute Probe → Evidence ⚠️ REQUIRED
- [ ] Step 6: Analyze Evidence
- [ ] Step 7: Fix + re-validate (skip if --no-fix or PASS)
- [ ] Step 8: Promote Probe + Knowledge Draft
- [ ] Step 9: Report
```

## Step 0: Parse target ⛔ BLOCKING

From `$ARGUMENTS`:

1. Target: URL (`http(s)://` / `localhost`) or file path / route description?
2. Scope: `--targeted` → Targeted; else Full Flow
3. Flags: `--init-only` / `--no-fix` / `--quick` / `--explore`?

Ask: if no URL/path and not `--init-only`, stop and ask for target.

File path: read file → infer page/route → resolve openable URL (ask for base URL if missing).

## Step 1: Ensure `.loopfix/` ⛔ BLOCKING

At **project root** (app git root, not this skill repo):

```bash
node <skill_dir>/scripts/init_loopfix.js
```

`<skill_dir>` = directory of this SKILL.md.

Scaffold: config, agent-browser ref, empty probes/drafts/runs. No project-local skill.

`--init-only` → print path summary and stop.

## Step 2: Knowledge lookup + Scope

1. Scan `.loopfix/knowledge/drafts/` (and future `rules/` / `patterns/`) for related drafts
2. Decide scope → load `references/validation-scope.md`
3. Ask: what does success look like? (key UI state, no console errors, 2xx APIs, …)
4. Ask: which **user-behavior loop** is this? (not which button)

## Step 3: Resolve Probe on disk ⛔ BLOCKING

Load `references/probe-format.md`.

1. Search `.loopfix/browser/probes/` — prefer `status: verified`, then `ready`, then `draft`
2. **Reuse** if same behavior loop (not merely same URL)
3. **New Probe** if different loop/sub-flow (e.g. page smoke vs VDAdd deep path) — do not overload the old smoke Probe
4. No match → **AI writes** `.loopfix/browser/probes/<name>.yaml` with `status: draft` now (incomplete OK; include known steps + expect stubs)
5. **Gate**: file must exist on disk before leaving this step

❌ Forbidden: "I'll write the yaml after I figure it out in the browser"  
✅ Allowed: thin draft → execute → refine file mid-run → promote later

Probe = browser actions only. No analysis. No fix plan.

## Step 4: Confirm plan ⚠️ REQUIRED

Unless `--quick`, confirm with a **Probe summary** (not a prose walkthrough):

- Target URL
- Scope: Full | Targeted
- Probe path + `status`
- `steps` count + `expect` count (1–2 lines)
- New vs reuse (and why, if new)
- Fixes allowed? (default yes; no if `--no-fix`)

⚠️ No browser until confirmed (`--quick` exempt).  
⚠️ No browser until Step 3 file exists (even with `--quick`), unless `--explore`.

## Step 5: Execute Probe → Evidence ⚠️ REQUIRED

Preflight: Probe file exists OR `--explore`. Else stop → Step 3.

**Only** browser layer: agent-browser.

```bash
agent-browser open <url> --headed
```

Before ops: `agent-browser skills get core` (or `--full`).  
Project conventions: load `.loopfix/references/agent-browser.md`.

**Perception budget:**

- Default: `snapshot` every interactive step
- Screenshot only when necessary → `references/evidence-format.md`
- Do not re-ingest PNGs if snapshot explains the failure

Execute **from the Probe file**. Missing step discovered → update YAML, then continue.

Evidence (peer artifact, not a child of Probe):

```
.loopfix/runs/<YYYY-MM-DD>-<slug>/
  evidence.json
  screenshot/     # may be empty on clean PASS
  report.md
```

Link run ↔ probe by name/path in `evidence.json`. Schema: `references/evidence-format.md`.

## Step 6: Analyze Evidence

Ask:

- Which Probe steps failed? snapshot / console / network?
- App bug, env issue, or stale/incomplete Probe?
- One-sentence root cause? (none → block Step 7)

## Step 7: Fix + re-validate (conditional)

When: failures **and** not `--no-fix` **and** root cause in app code.

Rules → `references/repair-principles.md`. Unless `--quick`: list files + reason; approve.

After fix → **same Probe file** → Step 5 again.

## Step 8: Promote Probe + Knowledge Draft

1. **Probe**: refine steps from what actually worked; set `status: verified` on PASS (or `ready` if intentionally partial). File already existed since Step 3 — this is promotion/refine, not first create.
2. **Knowledge Draft**: `.loopfix/knowledge/drafts/` per `references/knowledge-rules.md`. Ban page-level error filenames.

## Step 9: Report

1. PASS / FAIL
2. Probe path + status (before → after)
3. Evidence path
4. Fix summary (if any)
5. Knowledge Draft path (or none)

## Anti-Patterns

- Browser before Probe file on disk
- Writing Probe YAML only at Step 5/8 after exploring ("lazy persistence")
- Treating Probe as post-success recording instead of pre-exec contract
- One Probe per button/control
- Re-exploring a flow that already has a `verified`/`ready` Probe
- Overloading smoke Probe with unrelated deep sub-flows
- Verbal PASS without Evidence
- Screenshot every step / load every PNG into context
- AI assets outside `.loopfix/`

## Pre-Delivery Checklist

- [ ] Probe YAML existed **before** first `agent-browser` action (or `--explore` + draft before reuse claim)
- [ ] Probe split by user-behavior loop, not by single controls
- [ ] `status` updated (`draft` → `verified` on PASS when appropriate)
- [ ] Evidence run directory written; screenshots only if needed
- [ ] Steps driven by snapshot refs
- [ ] FAIL+fixed → re-ran same Probe file
- [ ] No Evidence-free "should be fine" claims
