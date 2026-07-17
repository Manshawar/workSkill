# Knowledge Rules

Knowledge ≠ error log. Skill stays generic; project facts under `.loopfix/knowledge/`.

## Ban

```
user-page-error.md
page-error-001.md
```

Ban project widget recipes inside the loopfix **skill**.

## Layout

```
knowledge/
  drafts/
  components/     # widget how-to (from Exploration / user teach)
  patterns/       # recurring failure shapes (from Failure Router)
  flows/
```

## Pattern examples (abstract)

```
knowledge/patterns/loading-stuck.md
knowledge/patterns/promise-error.md
knowledge/patterns/state-not-refresh.md
```

Template:

```markdown
# <Pattern name>

- Symptom:
- How to judge: (network → console → state → dom → action)
- Common causes:
- Fix direction:
- Related runs:
```

## Component template

`.loopfix/knowledge/components/<widget-slug>.md`:

```markdown
# <Widget>

- Open / select / confirm / success:
- Related action: browser/actions/...
- Source run:
```

## Chain

```
Evidence (+ verdict/category) → Incident → Pattern → Rule
```
