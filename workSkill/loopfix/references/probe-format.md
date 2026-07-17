# Probe Format

Probe = reusable browser flow (PASS or pending). Actions only — no analysis, no fixes.

## Path

`.loopfix/browser/probes/<name>.yaml`

## Schema

```yaml
name: user-create          # kebab-case
description: Create user full flow
base_url: http://localhost:3000   # CLI URL may override
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
  # actions: open | click | fill | type | select | wait | snapshot | screenshot

expect:
  - type: no_console_errors
  - type: url_contains
    value: /users
  - type: visible
    target: "Success"
```

## Rules

- After PASS, persist or update the Probe
- Never re-explore the same flow from scratch
- Prefer reuse over new Probe
