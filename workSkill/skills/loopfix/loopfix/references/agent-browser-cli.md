# agent-browser CLI (Failure Router subset)

Load only when debugging a FAIL (Step 6). Full docs: `agent-browser skills get core [--full]`

If `run_workflow.js` returns `AGENT_BROWSER_MISSING`, relay its `install` object — do not maintain a loopfix check script.

After sticky session (`browser_env.js` / orchestrator):

```bash
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
