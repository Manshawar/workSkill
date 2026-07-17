# Evidence Format

Evidence = facts. Not Knowledge.

## Path

`.loopfix/runs/<YYYY-MM-DD>-<slug>/`

```
evidence.json
screenshot/          # optional; often empty on clean PASS
report.md
```

## Primary signal: snapshot (not screenshot)

| Signal | When | Token cost |
|--------|------|------------|
| `snapshot` | **Every** interactive step | Low (text) |
| console / network | On errors or end of run | Low |
| `screenshot` | **Only if necessary** (below) | High if read into context |

### Screenshot only when

1. **FAIL** — capture the failing step (disk path in evidence; read image only if snapshot cannot explain)
2. **Visual suspicion** — layout/canvas/style/truncation that a11y tree cannot show
3. **Optional final archive** — one end-state PNG for humans, no need to reload into the model

### Do not

- Screenshot every step by default
- Treat screenshot as the main navigation sense
- Re-ingest all PNGs into context when `evidence.json` + snapshot text already suffice

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
      "snapshot_note": "Users table visible",
      "screenshot": null,
      "notes": ""
    }
  ],
  "console_errors": [],
  "network_errors": [],
  "final_url": "",
  "final_state": ""
}
```

`screenshot` may be `null` or omitted when unused.

## Required

- URL / steps
- console errors (if any)
- network errors (if any)
- final state (text from snapshot is enough on PASS)
- screenshots **only** per rules above — not mandatory on PASS

## report.md

Human summary: result, failed steps, root-cause hypothesis, next action (fix / no-fix).
