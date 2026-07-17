# agent-browser (project conventions)

Project rules only — not full CLI docs. For commands:

```bash
agent-browser skills get core
agent-browser skills get core --full
```

## Required

- **Headed**: `agent-browser open <url> --headed`
- Sole browser layer: agent-browser
- loopfix / validation-loop schedule + analyze only; do not reimplement browsing

## Typical flow

```bash
agent-browser open <url> --headed
agent-browser snapshot
agent-browser click @eN
agent-browser fill @eN "text"
agent-browser screenshot .loopfix/runs/<slug>/screenshot/step.png
agent-browser close
```

## Evidence collection

- screenshots: key steps + failures + final state
- console errors (via CLI capabilities)
- failed network requests (via CLI capabilities)
- write `.loopfix/runs/<slug>/evidence.json`
