# agent-browser (project conventions)

Happy path: `run_workflow.js` (session sticky inside).  
Debug only: network → console → errors → diff snapshot (Failure Router).

Missing CLI: `run_workflow.js` returns `AGENT_BROWSER_MISSING` + `install` — relay to user; no local check script.
