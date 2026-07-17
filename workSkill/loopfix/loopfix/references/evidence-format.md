# Evidence Format (loopfix attribution layer)

Base run Evidence: written by browser-orchestrator — see sibling `browser-orchestrator/references/evidence-schema.md`.

On FAIL / INCOMPLETE, loopfix **adds** Failure Router fields:

```json
{
  "verdict": "FAILED",
  "category": "APPLICATION_ERROR | API_ERROR | BROWSER_ERROR | ACTION_ERROR | UNKNOWN",
  "reason": "one-line cause",
  "suggestion": "where to look",
  "debug_order_checked": ["network", "console", "state", "dom", "action"]
}
```

No Action edits unless `category` is `ACTION_ERROR` or `BROWSER_ERROR`.  
Full routing: `failure-router.md`.
