# Workflow Schema

Path: `.loopfix/browser/workflows/<domain>/<id>.yaml`  
Index: `.loopfix/browser/workflows/index.yaml`

Workflow = **how to execute** in the browser. Not Probe (why validate).

## Index

```yaml
version: 1
workflows:
  user-create:
    description: Create user via UI
    path: user/create.yaml
    tags: [user]
```

## Workflow file

```yaml
id: user-create
base_url: http://localhost:3000
# optional sticky overrides — usually from browser_env.js
session: null

steps:
  - id: open-page
    action:
      type: open
    params:
      url: /users

  - id: open-dialog
    action:
      use: ui.dialog.open
    params:
      title: Create User

  - id: fill-name
    action:
      type: fill
    target:
      role: textbox
      name: Name
    params:
      value: demo

  - id: submit
    action:
      type: click
    target:
      text: Submit

  - id: verify
    action:
      type: snapshot
    expect:
      text_contains: demo
```

## Action types

| `action.type` | Meaning | agent-browser |
|---------------|---------|---------------|
| `open` | Navigate | `open <base+url>` |
| `click` | Click | `click` / `find … click` |
| `fill` | Clear+fill | `fill` / `find … fill` |
| `type` | Type | `type` |
| `select` | Select | `select` |
| `wait` | Wait | `wait …` |
| `snapshot` | A11y tree | `snapshot -i` |
| `screenshot` | Sparse capture | `screenshot <path>` |

Prefer `action.use: <family>.<name>` → expand from `browser/actions/`.

## Target (no brittle CSS)

```yaml
target:
  role: button
  name: Add
# or
target:
  text: Submit
# or
target:
  label: Email
# or (last resort after Action teach)
target:
  ref: "@e3"    # only inside resolved Action, not Flow hand-writes
```

**Ban:** `selector: ".el-button:nth-child(2)"` in workflows.

## Expect (optional per step)

```yaml
expect:
  text_contains: success
  url_contains: /users
  no_console_errors: true
```

Orchestrator records step FAIL if expect fails — does not invent fixes.
