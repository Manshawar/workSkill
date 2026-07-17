# Action Schema

Path: `.loopfix/browser/actions/<family>/<name>.yaml`

Action = reusable **how to operate** a control family. Project-local. Never in this skill.

## Native form (preferred)

```yaml
id: ui.dialog.open
family: ui
description: Open a modal dialog
params:
  title: string?

steps:
  - id: click-open
    action:
      type: click
    target:
      role: button
      name: "{{title}}"
  - id: after-open
    action:
      type: snapshot
```

`use: ui.dialog.open` expands these steps (param interpolate `{{name}}`).

## when/do form (compat)

Legacy / intent-routed actions:

```yaml
id: components.range-org-staff-input
params:
  intent: open | confirm

steps:
  - when: { intent: open }
    do:
      - action: click
        target: { role: button, name: "选择人员" }
      - action:
          type: snapshot
  - when: { intent: confirm }
    do:
      - action: click
        target: { text: "确定" }
```

Orchestrator matches `when` to workflow `params` (e.g. `params.intent: open`), expands matching `do` only.

## Families

```
actions/
  common/
  ui/
  components/
```

## UNKNOWN_ACTION

Missing file / unresolved target → status `UNKNOWN_ACTION`. No eval/guess/skip. User teaches → write Action → re-run.
