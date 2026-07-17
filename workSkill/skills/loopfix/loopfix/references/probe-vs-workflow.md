# Probe vs Workflow

Two artifacts — do not mix directories or schemas.

| | Probe | Workflow |
|--|-------|----------|
| Path | `.loopfix/browser/probes/<domain>/<id>.yaml` | `.loopfix/browser/workflows/<domain>/<id>.yaml` |
| Index | `browser/index.yaml` → `flows:` | `browser/workflows/index.yaml` → `workflows:` |
| Id field | prefer `name:` or `id:` (same slug) | **`id:`** required |
| Role | **Why** validate (goal, expect, status) | **How** execute (steps → agent-browser) |
| Runner | loopfix selects | `run_workflow.js` executes |

## Naming

Use the **same slug** for a pair when linked:

```
probes/vd/main-dispatch.yaml     name/id: vd-main-dispatch
workflows/vd/main-dispatch.yaml  id: vd-main-dispatch
```

Do **not** put Probe YAML under `workflows/` or Workflow under `probes/`.

## Status (Probe only)

`draft` → `ready` → (`partial`) → `verified` — see `probe-format.md`.  
Workflow files have no status machine; index may mirror probe status optionally.
