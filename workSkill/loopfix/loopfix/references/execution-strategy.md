# Execution Strategy

Principle: **Known capability → execute. Unknown capability → explore.**  
Loopfix ≠ step-by-step click robot.

## Pipeline (every page / major screen)

```
Resolve sticky session (browser_env.js)
 → Open Page (--session --restore --headed)
 → Analyze Page
 → Build Execution Plan
 → Execute (batch)
 → Verify
```

Do **not** open then immediately single-step click/fill/snapshot/analyze in a loop.
Do **not** open without project session (re-login tax).

## Page Analyze → Page Schema

After open (or major navigation):

1. `agent-browser snapshot -i --json` (interactive controls — prefer over full tree)
2. Map forms / controls; tag `native` | `action:<path>` | `unknown`
3. Emit Page Schema into Evidence / `page-schema.json`

See `references/agent-browser-cli.md` for CLI.

```json
{
  "url": "...",
  "elements": [
    { "name": "username", "type": "input", "strategy": "native" },
    { "name": "staff-selector", "type": "custom", "strategy": "unknown" },
    { "name": "start-date", "type": "date", "strategy": "action:ui/date-picker" }
  ]
}
```

`strategy`: `native` | `action:<path>` | `unknown`

## Interaction Resolution (priority)

| Priority | Case | Behavior |
|----------|------|----------|
| 1 | Matching Action under `browser/actions/` | **Call Action.** Ban re-explore |
| 2 | Native: input, textarea, checkbox, radio, plain select | Batch execute — no exploration |
| 3 | Custom / unclear / no Action | **Exploration Mode** — ask user, record, write Action |

Query Actions via index/path lookup for the element family — load **one** Action file, not the whole tree.

## Modes

### Replay Mode (default when Probe `ready`/`verified` + Actions exist)

- Follow Probe phases; expand Actions
- **Batch** consecutive known ops
- Snapshot only at phase boundaries / verify / failure
- Minimize LLM re-planning

### Exploration Mode (unknown capability only)

- Step-by-step allowed
- Ask user (UNKNOWN_INTERACTION rules)
- Record real ops → new Action + `knowledge/components/`
- Ban eval placeholder / guess click / skip

Mode can switch mid-flow: known segments Replay; hit unknown → Exploration for that element only.

## Batch Execution

**Forbidden pattern:**

```
fill → snapshot → analyze → fill → snapshot → analyze → …
```

**Required pattern:**

```
Analyze (Page Schema)
 → Execution Plan (ordered batches)
 → Batch execute known ops
 → Snapshot/verify at checkpoints
 → Next batch or Exploration if unknown
```

Checkpoint snapshots: after prepare, after input batch, after submit, at verify. Not after every keystroke.

## Probe shape

Probe = business phases + Action refs. **Not** a browser op log.

Bad:

```yaml
steps:
  - { action: click }
  - { action: snapshot }
  - { action: fill }
  - { action: snapshot }
```

Good: see `probe-format.md` (`prepare` / `input` / `submit` / `verify`).
