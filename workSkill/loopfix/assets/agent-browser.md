# agent-browser (project conventions)

Project rules only — not full CLI docs. For commands:

```bash
agent-browser skills get core
agent-browser skills get core --full
```

## Required

- **Headed**: `agent-browser open <url> --headed`
- Sole browser layer: agent-browser
- loopfix schedules + analyzes only; do not reimplement browsing

## Typical flow

```bash
agent-browser open <url> --headed
agent-browser snapshot          # primary sense — use every step
agent-browser click @eN
agent-browser fill @eN "text"
# screenshot ONLY on fail / visual doubt / optional final archive:
# agent-browser screenshot .loopfix/runs/<slug>/screenshot/fail.png
agent-browser close
```

## Evidence collection

- **Default**: snapshot notes + console/network → `evidence.json`
- **Screenshot**: fail step, visual-only bugs, or one optional final PNG for humans
- Prefer disk path in evidence over re-reading images into the model
- write `.loopfix/runs/<slug>/evidence.json`
