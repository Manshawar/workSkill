# Action Format

Canonical schema: sibling skill `browser-orchestrator/references/action-schema.md`.

Project path: `.loopfix/browser/actions/<family>/<name>.yaml`

Rules:
- Action = how to operate a control — not business goal
- Unknown → `UNKNOWN_ACTION` → user teach → write project Action (never this skill)
- Probe/Workflow `use:` expands Action; do not hardcode CSS nth-child
