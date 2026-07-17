# Validation Scope

## Full Flow (default)

Triggers: "validate this page", "check this feature", "verify \<url\>".

Run the full business flow, e.g. enter → search → create → edit → delete → paginate → filter.

**Do not** only click the changed control. One change can break adjacent flows.

## Targeted

Triggers: user names a single control/step ("only the create button", "just login").

Run only related steps to cut cost.

Decide:

- Named single control/step? + `--targeted` or explicit "only" → Targeted
- Otherwise → Full Flow
