# Flow Probe Format

Flow Probe = **pre-exec contract** for a **user-behavior loop** (goal), not a component test.

Layers: `Flow Probe → Action → agent-browser`.

## Path

`.loopfix/browser/probes/<domain>/<flow>.yaml`  
Example: `probes/user/create-user.yaml`

Register every flow in `browser/index.yaml` → `references/registry-format.md`.

## Status

```yaml
status: draft   # draft | ready | verified | deprecated
```

| Status | Bar |
|--------|-----|
| `draft` | Incomplete OK; **cannot** claim formal Flow PASS |
| `ready` | Every step has concrete `action` / `ref` / `use`; OR explicit `skip_reason` + `skip_needs`. No eval placeholders. No pretending unknown ops succeeded |
| `verified` | At least one Flow PASS Evidence (last step + all expects + no UNKNOWN + no unresolved blockers) |
| `deprecated` | Do not select |

## Schema

```yaml
name: create-user
status: draft
goal: User created and visible in list
base_url: http://localhost:3000
scope: full                 # full | targeted
tags: [user, crud]

steps:
  - id: open
    action: open
    url: /users
  - id: open-dialog
    use: actions/ui/dialog.yaml
    with:
      intent: open
      title: Create User
  - id: fill-form
    use: actions/ui/form.yaml
    with:
      fields:
        name: "demo"
  - id: submit
    action: click
    target: "Submit"
  - id: verify
    action: snapshot

  # If a step cannot run yet:
  # - id: assign-owner
  #   skip_reason: unknown owner picker interaction
  #   skip_needs: how to open, select, confirm, success state

expect:
  - type: no_console_errors
  - type: visible
    target: "demo"
  - type: url_contains
    value: /users
```

Primitive `action` values: `open | click | fill | type | select | wait | snapshot`  
(screenshot not a default step)

`use:` → expand Action file (`references/action-format.md`).

## Split rules

| Do | Don't |
|----|-------|
| One Probe per user-behavior loop | One Probe per button/dialog |
| Domain folders (`user/`, `order/`) | Flat button-click.yaml zoo |
| Reference Actions for reusable widgets | Embed project widget recipes in skill |

Same URL + different loop → **new** Probe. Same loop → reuse/extend.

## Flow PASS (restate)

```
last_executed_step_id == last_step_id
AND all expect pass
AND no unresolved UNKNOWN_INTERACTION
AND no unresolved blocking exceptions
```

Else `FAIL` or `INCOMPLETE` — never inflate to PASS.

## Draft quality bar (pre-exec)

AI writes file before browser:

- `name`, `status`, `goal`, `scope`, entry step, expect stubs
- Known middle steps as labels/`use` stubs OK in `draft`
- Register in `index.yaml`
