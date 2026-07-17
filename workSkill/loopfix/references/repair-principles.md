# Repair Principles

Load `references/failure-router.md` **before** any fix.

- **Attribute first** — category in Evidence; do not default to Action/selector tweaks
- **Prefer app/API fixes** when network/console/state implicate product code
- **Action edits only** for `ACTION_ERROR` / `BROWSER_ERROR` (or user override)
- **Minimal change** — restore correct behavior only
- **Ban**: sleep-to-pass, drop expects, skip broken business steps in Action, drive-by refactors
- **Re-validate**: same Probe, headed, after every fix
- **Gate**: no clear root cause → no code change
