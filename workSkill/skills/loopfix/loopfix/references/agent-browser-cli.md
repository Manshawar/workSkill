# agent-browser CLI (Failure Router subset)

Load only when debugging a FAIL (Step 6). Full docs: `agent-browser skills get core [--full]`

**Sticky session first** — reuse orchestrator session, don't cold-start:

```bash
node <loopfix>/scripts/browser_env.js --cwd <project>   # → flags, session, relay_login
# every ad-hoc command: agent-browser <flags from JSON> <cmd>
```

If `run_workflow.js` returns `AGENT_BROWSER_MISSING`, relay its `install` object.

Debug commands (with sticky flags):
agent-browser network requests --type xhr,fetch
agent-browser network requests --status 4xx
agent-browser console
agent-browser errors
agent-browser get url
agent-browser diff snapshot
agent-browser screenshot .loopfix/runs/<slug>/screenshot/fail.png
```

Debug order: network → console → state → dom → action (last).  
`eval` = last resort; ban as unknown-widget placeholder.  
Happy-path clicks: **browser-orchestrator** only — not this file.
