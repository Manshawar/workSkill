# Validation Scope

Object of validation = **user-behavior loop**, not a button/component.

## Full Flow (default)

Run the business loop, e.g.:

enter → query → create → edit → delete → paginate → filter

Collect **all** issues in one run when safe. Do not stop at first glitch and call the flow done.

Step success (validation msg / button present / API 2xx) ≠ Flow PASS.

## Targeted

User names one loop ("only create user", "only VDAdd path").

Still a behavior loop — not a single control click Probe.

## Decide

- Named single loop / "only …" / `--targeted` → Targeted
- Else → Full Flow
