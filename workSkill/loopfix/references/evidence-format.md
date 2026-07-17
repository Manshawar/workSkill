# Evidence Format

Evidence = one real execution. Peer of Probe (not child).

```
Flow Probe (how) + Execution → Evidence (what happened)
```

## Path

`.loopfix/runs/<YYYY-MM-DD>-<slug>/`

```
evidence.json
screenshot/          # optional
report.md
```

## Perception

| Signal | When |
|--------|------|
| `snapshot` | Every interactive step (default) |
| console / network | Errors + end |
| `screenshot` | Fail / visual-only doubt / optional final archive — sparse |

Do not screenshot every step. Prefer disk path over re-reading PNGs.

## evidence.json

```json
{
  "run_id": "20260717-user-create",
  "flow": "user-create",
  "probe": "probes/user/create-user.yaml",
  "target": "http://localhost:3000/users",
  "scope": "full",
  "started_at": "ISO-8601",
  "ended_at": "ISO-8601",
  "flow_result": "PASS | FAIL | INCOMPLETE",
  "halted_at": null,
  "last_executed_step_id": "verify",
  "last_step_id": "verify",
  "unknown_interactions": [],
  "steps": [
    {
      "id": "open",
      "action": "open",
      "result": "ok",
      "url": "http://localhost:3000/users",
      "snapshot_note": "list visible",
      "screenshot": null,
      "console": [],
      "network": [],
      "notes": ""
    }
  ],
  "expect_results": [
    { "type": "visible", "target": "demo", "ok": true }
  ],
  "console_errors": [],
  "network_errors": [],
  "final_url": "",
  "final_state": ""
}
```

Step `result`: `ok | fail | skip | unknown`

`halted_at`: step id when stopped early / UNKNOWN_INTERACTION wait; else `null`.

`flow_result` must follow Flow PASS rules in SKILL.md — never mark `PASS` if INCOMPLETE conditions hold.

## report.md

Flow Result, halted_at, failed/unknown steps, issues list, next action.
