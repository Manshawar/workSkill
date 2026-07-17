# Evidence Schema (orchestrator runs)

Path: `.loopfix/runs/<run-id>/`

```
evidence.json
report.md
screenshot/     # only if workflow requested or fail capture
```

## evidence.json

```json
{
  "run_id": "20260717-user-create-a1b2",
  "workflow": "user-create",
  "workflow_path": "browser/workflows/user/create.yaml",
  "status": "PASS",
  "started_at": "ISO-8601",
  "ended_at": "ISO-8601",
  "session": "loopfix-…",
  "steps": [
    { "id": "open-page", "status": "PASS", "action": "open", "detail": "" }
  ],
  "unknown_actions": [],
  "errors": [],
  "expect_failures": []
}
```

`status`: `PASS` | `FAIL` | `UNKNOWN_ACTION` | `INCOMPLETE`

Step `status`: `PASS` | `FAIL` | `SKIP` | `UNKNOWN_ACTION`

## report.md

Short human summary: status, failed/unknown steps, evidence path. No fix advice (loopfix owns that).
