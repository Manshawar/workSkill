# Boundary: browser-orchestrator vs agent-browser

| | agent-browser (official) | browser-orchestrator (this) |
|--|--------------------------|-----------------------------|
| Role | Browser atoms | Workflow runner |
| Owns | click/fill/snapshot/console/network CLI | load workflow, resolve Action, batch invoke, Evidence |
| Skill edits | **Never modify** | Own SKILL + scripts only |
| Project knowledge | None | None in skill; Actions live in `.loopfix/browser/actions/` |
| LLM | May use atoms for ad-hoc debug | Must use for LoopFix flows — no step-click in chat |

## Call pattern

```
orchestrator script
  → builds argv list
  → agent-browser --session S --restore --headed batch --bail "…" "…"
  → reads console/network on FAIL (optional script hooks)
  → writes Evidence
```

Ad-hoc `agent-browser` in loopfix chat for Failure Router inspection (console/network) is OK.  
**Driving a whole create-user flow via chat clicks is not** — use this orchestrator.

## Forbidden

- Forking/vendoring agent-browser into LoopFix
- Wrapping atoms with different semantics
- Teaching "how Element Plus works" inside either skill
