# agent-browser (project conventions)

Skill CLI subset: install skill's `references/agent-browser-cli.md`.  
Refresh: `agent-browser skills get core`

## Persistent login (required)

```bash
node <loopfix-skill>/scripts/browser_env.js
# use returned flags / export AGENT_BROWSER_SESSION + RESTORE + HEADED
```

`.loopfix/config.yaml`:

```yaml
browser:
  session: auto
  restore: true
  headed: true
```

- Same session across Cursor windows — **no re-login**
- Never bare `open` without session
- Never `close --all` on this shared session

## Typical

```bash
eval $(node <loopfix-skill>/scripts/browser_env.js --export)
agent-browser open <url>
agent-browser wait --load networkidle
agent-browser snapshot -i --json
agent-browser console
agent-browser network requests --type xhr,fetch
```

Screenshot sparse → `.loopfix/runs/<slug>/screenshot/`
