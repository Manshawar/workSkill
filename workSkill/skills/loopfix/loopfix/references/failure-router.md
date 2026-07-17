# Failure Router

Principle: **agent-browser is observer/executor — not the default fix target.**

On verification failure: **classify before changing Actions/selectors/scripts.**

```
Verification Failed
 → Failure Router
 → BROWSER_*  or  APPLICATION_* / API_*
```

## Debug order (mandatory)

```
1. Network     → agent-browser network requests [--type xhr,fetch] [--status 4xx]
2. Console     → agent-browser console / errors
3. Runtime     → get url/title; sparse eval for loading flags (not placeholders)
4. DOM delta   → agent-browser diff snapshot
5. Action      → locator/ref/Action YAML  ← last
```

CLI detail: `references/agent-browser-cli.md`.

## Categories

| Category | Meaning | Fix target |
|----------|---------|------------|
| `APPLICATION_ERROR` | App logic/UI state wrong | App code |
| `API_ERROR` | Request/response/contract bad | API / client call sites |
| `BROWSER_ERROR` | Tool/session/CDP/env | Browser env / retry headed |
| `AGENT_BROWSER_MISSING` | CLI not installed (`spawn ENOENT`) | Relay `install` from orchestrator JSON; retry after user installs |
| `ACTION_ERROR` | Wrong/missing Action, stale ref, locator | `.loopfix/browser/actions` |
| `UNKNOWN` | Cannot classify yet | Gather more Evidence; ask user |

## When Action/browser changes are allowed

**ACTION_ERROR / BROWSER_ERROR only if:**

1. Locator/ref wrong or snapshot stale **and** network/console/state look healthy for the goal
2. Missing reusable interaction capability (no Action for a real widget) after user taught it

Then update `browser/actions/` (or env). Still re-run Probe.

## When must treat as application/API

| Signal | Category | Direction |
|--------|----------|-----------|
| Submit → loading stuck after request finished | `APPLICATION_ERROR` | Trace submit / loading flag |
| Request fail / bad payload / schema drift | `API_ERROR` | API + client |
| Click + API ok, UI not refresh | `APPLICATION_ERROR` | State/update path |
| Console: TypeError / undefined fn | `APPLICATION_ERROR` | Stack → source |
| Long hang / no UI progress while network idle or error | Prefer app/API first | Not "Action too slow" |

## Browser self-heal ban

**Forbidden** to make the script "pass":

- Extra sleep to hide race
- Ignore failed expect / drop assertions
- Rewrite Action to skip the broken business step
- Retry loops that mask app bugs

**Required:**

```
Fail → attribute → fix real cause → re-run same Probe
```

## Evidence fields

Every FAIL/INCOMPLETE Evidence must include attribution (see `evidence-format.md`):

```json
{
  "verdict": "FAILED",
  "category": "APPLICATION_ERROR",
  "reason": "loading state not reset after submit response",
  "suggestion": "trace submit handler and loading flag",
  "debug_order_checked": ["network", "console", "state", "dom", "action"]
}
```

No Action edit until `category` is `ACTION_ERROR` or `BROWSER_ERROR` (or user overrides).

## Knowledge

Abstract to `knowledge/patterns/` — not page error files:

- `loading-stuck.md`
- `promise-error.md`
- `state-not-refresh.md`

Each: symptom, how to judge, common causes, fix direction.
