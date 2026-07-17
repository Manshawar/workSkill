# Probe Format

Probe = **executable contract** for a user-behavior loop. Actions only — no analysis, no fixes.

Created **before** browser execution (`draft` OK). Refined during/after runs. Promoted to `verified` on PASS.

## Path

`.loopfix/browser/probes/<name>.yaml`

## Status

```yaml
status: draft       # draft | ready | verified | deprecated
```

| Status | Use |
|--------|-----|
| `draft` | Pre-exec required minimum; AI may leave gaps |
| `ready` | Steps filled; not yet Evidence-PASS |
| `verified` | Prefer for reuse |
| `deprecated` | Do not reuse |

## Schema

```yaml
name: user-create
status: draft
description: Create-user behavior loop
base_url: http://localhost:3000
scope: full                # full | targeted
tags: [user, crud]

steps:
  - id: open
    action: open
    url: /users
  - id: search
    action: fill
    target: "Search"       # human label; resolve via snapshot refs at runtime
    value: "test"
  - id: create
    action: click
    target: "Create"
  # actions: open | click | fill | type | select | wait | snapshot
  # screenshot: not a default step

expect:
  - type: no_console_errors
  - type: url_contains
    value: /users
  - type: visible
    target: "Success"
```

## Flow Probe + Sub Probe

Split by **user-behavior loop**, not by page element.

Bad (explodes):

```
create-button.yaml
cancel-button.yaml
refresh-button.yaml
```

Good:

```
user-management.yaml    # flow: query / create / edit / delete
user-create.yaml         # sub-loop if reused across flows
```

Flow may reference subs:

```yaml
name: user-management
status: draft
scope: full
steps:
  - id: query
    ref: user-list-query.yaml
  - id: create
    ref: user-create.yaml
  - id: delete
    ref: user-delete.yaml
```

`ref` = another file under `browser/probes/` (basename or relative). Execute by inlining the referenced Probe's steps.

## Reuse vs new

| Situation | Action |
|-----------|--------|
| Same behavior loop, Probe `verified`/`ready` | Reuse; update if UI drifted |
| Same URL, **different** loop (smoke vs deep add) | **New** Probe; keep old smoke intact |
| Single control click inside an existing loop | Extend that Probe's steps — do **not** new file per button |
| Unknown flow | New `draft` with best-known steps + expect stubs |

## Draft quality bar (pre-exec)

Enough to start — not a novel:

- `name`, `status: draft`, `base_url` or target URL, `scope`
- At least the **entry** step + intended outcome in `expect`
- Named steps for the loop you plan to cover (stubs OK: `target` labels without perfect selectors)

AI generates this file. Humans are not required to hand-write full YAML.

## Rules

- No Probe file → no execution (unless `--explore`)
- Mid-run gaps → edit the Probe, then continue
- After PASS → `status: verified` (or `ready` if partial by intent)
- Never re-explore from scratch when a matching Probe exists
- Prefer `verified` > `ready` > `draft` when choosing reuse
