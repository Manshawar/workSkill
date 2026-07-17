# Knowledge Rules

## Ban

Page-level error notes:

```
user-page-error.md
order-page-error.md
```

## Abstract instead

| Type | Meaning |
|------|---------|
| Rule | Long-lived rule |
| Pattern | Recurring problem shape |
| Incident | Concrete case |

Cross-ref:

```
Probe Definition → Probe Execution → Evidence → Incident → Pattern → Rule
```

## MVP write path

`.loopfix/knowledge/drafts/<topic>.md`:

```markdown
# <Abstract title, not a page name>

- Type: pattern | rule | incident
- Related probe: <name>
- Run: .loopfix/runs/<id>/
- Summary: <1-2 sentences>
- Guidance: <how to avoid / how to re-verify>
```
