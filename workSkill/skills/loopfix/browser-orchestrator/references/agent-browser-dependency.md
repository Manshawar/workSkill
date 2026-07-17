# agent-browser dependency (official)

LoopFix suite **does not** ship browser automation. Use Vercel official layer only.

## Required before browser execution

```bash
npx skills add vercel-labs/agent-browser
npm install -g agent-browser
agent-browser install   # Chrome for Testing, first time
```

Check:

```bash
node <this_skill>/scripts/check_agent_browser.js
```

## Roles

| Layer | Owner |
|-------|--------|
| Atoms (click/fill/snapshot) | **agent-browser** skill + CLI |
| Workflow batch | **browser-orchestrator** |
| Why validate / repair | **loopfix** |

Never modify or copy the official agent-browser skill.
