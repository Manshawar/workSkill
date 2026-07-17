# agent-browser CLI (LoopFix subset)

Upstream: [agent-browser README](https://github.com/vercel-labs/agent-browser/blob/main/README.md)  
**Version truth:** `agent-browser skills get core [--full]`

## Install check (before first run)

```bash
node <suite>/browser-orchestrator/scripts/check_agent_browser.js
```

If missing:

```bash
npx skills add vercel-labs/agent-browser
npm install -g agent-browser
agent-browser install
```

## Persistent session (required)

Cold browser each Cursor window = re-login = wasted tokens. **Always** pin session.

```bash
# Resolve once per run (from .loopfix/config.yaml)
node <suite>/loopfix/scripts/browser_env.js
# → { session, flags: "--session … --restore --headed", open_example }

eval $(node <suite>/loopfix/scripts/browser_env.js --export)
agent-browser open <url>          # picks up AGENT_BROWSER_* env
# or:
agent-browser --session "$AGENT_BROWSER_SESSION" --restore --headed open <url>
```

Config (`.loopfix/config.yaml`):

```yaml
browser:
  session: auto    # or fixed name
  restore: true
  headed: true
```

**Rules:**
- Every `open` / `batch` / interaction uses same session flags (or env)
- **Ban** bare `agent-browser open` without session/restore
- **Ban** `close --all` on shared project session (kills other chats' browser)
- Prefer leave browser up; if must close: `agent-browser close` (single session) so `--restore` can reload next time
- First run: login once in headed window; later runs restore cookies

## Core

```bash
npm i -g agent-browser && agent-browser install   # once
agent-browser snapshot -i --json
agent-browser click @e2
agent-browser fill @e3 "value"
```

Overlay blocks click → dismiss → **fresh snapshot**.

## Native

```bash
agent-browser find role button click --name "Submit"
agent-browser find label "Email" fill "a@b.com"
```

## Replay batch

Include session flags on `open` (or rely on exported env):

```bash
eval $(node <suite>/loopfix/scripts/browser_env.js --export)
agent-browser batch --bail \
  "open http://localhost:3000" \
  "wait --load networkidle" \
  "snapshot -i" \
  "fill @e3 demo" \
  "click @e5"
```

## Wait

```bash
agent-browser wait --load networkidle
agent-browser wait "#spinner" --state hidden
```

## Failure Router CLI

```bash
agent-browser network requests --type xhr,fetch
agent-browser console
agent-browser errors
agent-browser diff snapshot
agent-browser screenshot .loopfix/runs/<slug>/screenshot/fail.png
```

`eval` = last resort; **ban** as unknown-widget placeholder.
