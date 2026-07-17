# Evidence Format

Evidence = facts. Not Knowledge.

## Path

`.loopfix/runs/<YYYY-MM-DD>-<slug>/`

```
evidence.json
screenshot/
report.md
```

## evidence.json

```json
{
  "run_id": "2026-07-17-user-flow",
  "target": "http://localhost:3000/users",
  "scope": "full",
  "probe": "user-create",
  "started_at": "ISO-8601",
  "ended_at": "ISO-8601",
  "result": "pass | fail",
  "steps": [
    {
      "id": "open",
      "action": "open",
      "url": "http://localhost:3000/users",
      "ok": true,
      "screenshot": "screenshot/01-open.png",
      "notes": ""
    }
  ],
  "console_errors": [],
  "network_errors": [],
  "final_url": "",
  "final_state": ""
}
```

## Required

- URL / steps
- console errors (if any)
- network errors (if any)
- screenshots (key fail steps + final state)
- final state

## report.md

Human summary: result, failed steps, root-cause hypothesis, next action (fix / no-fix).
