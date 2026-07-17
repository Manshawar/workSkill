# Flow Probe Format

Flow Probe = **pre-exec business contract**, not browser op log.

Layers: `Flow Probe → Action → agent-browser`.

## Path

`.loopfix/browser/probes/<domain>/<flow>.yaml`  
Register in `browser/index.yaml` → `references/registry-format.md`.

## Status

| Status | Bar |
|--------|-----|
| `draft` | Incomplete OK; no formal Flow PASS |
| `ready` | Phases/steps resolvable via Action/native; or explicit `skip_reason` + `skip_needs` |
| `verified` | Flow PASS Evidence once |
| `deprecated` | Do not select |

## Schema (phase-oriented)

```yaml
name: create-user
status: draft
goal: User created and visible in list
base_url: http://localhost:3000
scope: full
tags: [user, crud]

prepare:
  - id: open
    action: open
    url: /users
  - id: open-dialog
    use: actions/ui/dialog.yaml
    with: { intent: open, title: Create User }

input:
  - id: fill-basic
    use: actions/ui/form.yaml
    with:
      fields: { name: "demo" }
  - id: select-owner
    use: actions/components/staff-selector.yaml
    with: { value: "Alice" }
    # or skip_reason / skip_needs if unknown

submit:
  - id: submit-form
    action: click
    target: "Submit"

verify:
  - id: check-created
    expect_local:
      - { type: visible, target: "demo" }

expect:
  - type: no_console_errors
  - type: visible
    target: "demo"
```

Flat `steps:` still allowed for tiny probes; prefer phases for real flows.

Phases run in order: `prepare → input → submit → verify`.

Primitive `action`: `open | click | fill | type | select | wait | snapshot`  
`use:` → Action (canonical: browser-orchestrator `action-schema.md`; local pointer `action-format.md`).

## Ban

- Click/snapshot/fill/snapshot logs as Probe body
- One Probe per button
- Embedding project widget recipes in the skill
- Flat `probes/*.yaml` zoo — use `probes/<domain>/<flow>.yaml`

## Flow PASS

```
last_executed_step_id == last_step_id
AND all expect pass
AND no unresolved UNKNOWN_INTERACTION
AND no unresolved blocking exceptions
```

Else `FAIL` / `INCOMPLETE`.

## Draft bar

Before browser: `name`, `status`, `goal`, phases stubs, `expect`, index entry. AI writes draft.
