# Knowledge Rules

Knowledge ≠ error log. Skill stays generic; **project** facts live under `.loopfix/knowledge/`.

## Ban

```
user-page-error.md
page-error-001.md
```

Ban writing project widget recipes into the loopfix **skill**.

## Layout

```
knowledge/
  drafts/         # raw extractions notes
  components/     # how a project widget works
  patterns/       # recurring problem shapes
  flows/          # flow-level learnings
```

## Types

| Type | Where | Meaning |
|------|-------|---------|
| component | `components/` | Open/select/confirm/success for a project control |
| pattern | `patterns/` | Recurring failure shape |
| flow | `flows/` | Cross-cutting flow notes |
| incident | `drafts/` → promote | One Evidence-backed case |
| rule | promote from pattern | Long-lived constraint |

Chain:

```
Evidence → Incident → Pattern → Rule
```

## Component note template

`.loopfix/knowledge/components/<widget-slug>.md`:

```markdown
# <Widget name>

- Open:
- Select / input:
- Confirm:
- Success state:
- Related action: browser/actions/...
- Source run: .loopfix/runs/...
```

Created after UNKNOWN_INTERACTION + user answer (or after verified discovery).

## Draft template

`.loopfix/knowledge/drafts/<topic>.md`:

```markdown
# <Abstract title>

- Type: pattern | rule | incident | flow
- Related flow: <flow id>
- Run: .loopfix/runs/<id>/
- Summary:
- Guidance:
```
