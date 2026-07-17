# Action Schema

Path: `.loopfix/browser/actions/<family>/<name>.yaml`

Action = reusable **how to operate** a control family. Project-local. Never in this skill.

## File

```yaml
id: ui.dialog.open
family: ui
description: Open a modal dialog
params:
  title: string?

steps:
  - action:
      type: click
    target:
      role: button
      name: "{{title}}"
  - action:
      type: snapshot
```

`use: ui.dialog.open` in a Workflow expands these steps (param interpolate `{{name}}`).

## Families (suggested dirs)

```
actions/
  common/
  ui/           # generic patterns (dialog, form) — framework-agnostic names
  components/   # project-specific widgets
```

No Vue/React binding in skill docs — project may name folders freely.

## UNKNOWN_ACTION

If Workflow `use:` has no file, or target cannot resolve:

- Orchestrator status: `UNKNOWN_ACTION`
- Do not eval / random click / skip
- User teaches → write Action under `browser/actions/` → re-run
