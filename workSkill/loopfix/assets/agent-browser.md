# agent-browser (project conventions)

Full LoopFix CLI subset (from upstream README): skill `references/agent-browser-cli.md`.  
Always refresh with: `agent-browser skills get core`

## Required

- Headed: `agent-browser open <url> --headed`
- Analyze: `snapshot -i` (interactive) before planning
- Replay: `batch --bail` for known Action chains
- Fail debug: `network requests` → `console` / `errors` → state → `diff snapshot` → Action last

## Typical Replay

```bash
agent-browser open <url> --headed
agent-browser wait --load networkidle
agent-browser snapshot -i --json
# … batch known fills/clicks …
agent-browser console
agent-browser network requests --type xhr,fetch
agent-browser close
```

Screenshot only on fail / visual doubt / optional archive → `.loopfix/runs/<slug>/screenshot/`
