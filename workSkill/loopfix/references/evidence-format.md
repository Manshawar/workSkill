# Evidence Format

Evidence = one real execution. Peer of Probe.

## Path

`.loopfix/runs/<YYYY-MM-DD>-<slug>/`

```
evidence.json
screenshot/          # optional / sparse
report.md
page-schema.json     # optional; from Page Analyze
```

## Perception

| Mode | Snapshot |
|------|----------|
| Replay / batch | Phase checkpoints + fail + verify |
| Exploration | As needed for unknown widget |
| Never | After every single fill/click by default |

Screenshot: fail / visual-only / optional final archive only.

## evidence.json

```json
{
  "run_id": "20260717-user-create",
  "flow": "user-create",
  "probe": "probes/user/create-user.yaml",
  "mode": "replay | exploration | mixed",
  "target": "http://localhost:3000/users",
  "started_at": "ISO-8601",
  "ended_at": "ISO-8601",
  "flow_result": "PASS | FAIL | INCOMPLETE",
  "verdict": "PASSED | FAILED | INCOMPLETE",
  "category": null,
  "reason": null,
  "suggestion": null,
  "debug_order_checked": [],
  "halted_at": null,
  "last_executed_step_id": "check-created",
  "last_step_id": "check-created",
  "unknown_interactions": [],
  "page_schema_ref": "page-schema.json",
  "steps": [
    {
      "id": "open",
      "phase": "prepare",
      "action": "open",
      "result": "ok",
      "strategy": "native",
      "snapshot_note": "list visible",
      "screenshot": null,
      "notes": ""
    }
  ],
  "expect_results": [],
  "console_errors": [],
  "network_errors": [],
  "final_url": "",
  "final_state": ""
}
```

### Attribution (required on FAIL / INCOMPLETE)

| Field | Values |
|-------|--------|
| `category` | `APPLICATION_ERROR` \| `API_ERROR` \| `BROWSER_ERROR` \| `ACTION_ERROR` \| `UNKNOWN` |
| `reason` | One-line cause |
| `suggestion` | Where to look / what to fix |
| `debug_order_checked` | Subset of `network, console, state, dom, action` in that order |

No Action edits unless category is `ACTION_ERROR` or `BROWSER_ERROR` (see `failure-router.md`).

Step `result`: `ok | fail | skip | unknown`  
Step `strategy`: `native | action | unknown`

## report.md

Flow Result, verdict/category/reason, halted_at, issues, next fix target (app vs action).
