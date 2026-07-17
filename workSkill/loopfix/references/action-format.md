# Action Format

Action = reusable **how to operate** a UI pattern/widget. No business goal.

Used by Flow Probes via `use:`.

## Path

`.loopfix/browser/actions/<family>/<name>.yaml`

Examples (generic — not project-specific):

```
actions/ui/dialog.yaml
actions/ui/form.yaml
actions/components/custom-selector.yaml   # project-local OK
```

Framework-agnostic. Do **not** put Action recipes into the loopfix skill.

## Schema

```yaml
name: dialog
family: ui
description: Open/close a modal dialog
version: 1

params:
  intent: open | close | confirm
  title: string?

steps:
  - when: { intent: open }
    do:
      - action: click
        target: "{{title}} related open control"
      - action: snapshot
  - when: { intent: confirm }
    do:
      - action: click
        target: "OK"
```

Keep steps declarative. Resolve labels → snapshot refs at runtime.

## Rules

- Actions describe open / input / select / confirm — **not** "create user"
- Unknown interaction → do not invent Action; raise UNKNOWN_INTERACTION; ask user; then write Action + optional `knowledge/components/`
- Prefer small composable Actions over mega files
- Flow Probe owns `goal` + `expect`; Action owns mechanics
