# agent-browser (project conventions)

Not full CLI docs:

```bash
agent-browser skills get core
agent-browser skills get core --full
```

## Required

- Headed: `agent-browser open <url> --headed`
- Sole browser layer: agent-browser
- loopfix schedules only

## Selection → execute

1. Read `.loopfix/browser/index.yaml` (catalog only)
2. Load one Flow Probe
3. Expand `use:` Actions
4. Run primitives via agent-browser

## Typical

```bash
agent-browser open <url> --headed
agent-browser snapshot
agent-browser click @eN
agent-browser fill @eN "text"
# screenshot only on fail / visual doubt / optional archive
agent-browser close
```

## UNKNOWN_INTERACTION

No eval placeholders / guess clicks. Ask user → write Action + knowledge/components.
