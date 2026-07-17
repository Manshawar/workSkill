# agent-browser CLI (LoopFix subset)

Upstream: [agent-browser README](https://github.com/vercel-labs/agent-browser/blob/main/README.md)  
**Version truth:** `agent-browser skills get core [--full]`

## Core

```bash
npm i -g agent-browser && agent-browser install   # once
agent-browser open <url> --headed                 # AGENT_BROWSER_HEADED=1
agent-browser snapshot -i --json                  # Page Analyze (interactive)
agent-browser click @e2
agent-browser fill @e3 "value"
agent-browser close
```

Overlay blocks click → dismiss → **fresh snapshot** (refs stale).

## Native

```bash
agent-browser find role button click --name "Submit"
agent-browser find label "Email" fill "a@b.com"
agent-browser check @eN
agent-browser select @eN "option"
```

## Replay batch

```bash
agent-browser batch --bail \
  "open http://localhost:3000 --headed" \
  "wait --load networkidle" \
  "snapshot -i" \
  "fill @e3 demo" \
  "click @e5"
```

## Wait (prefer state, not sleep-to-pass)

```bash
agent-browser wait --load networkidle
agent-browser wait "#spinner" --state hidden
agent-browser wait --fn "!document.body.innerText.includes('Loading')"
```

## Failure Router CLI

```bash
agent-browser network requests --type xhr,fetch
agent-browser network requests --status 4xx
agent-browser console
agent-browser errors
agent-browser get url
agent-browser diff snapshot
agent-browser screenshot .loopfix/runs/<slug>/screenshot/fail.png   # sparse
```

`eval` = last resort for state reads; **ban** as unknown-widget placeholder.

Auth/HAR/session: use `skills get core` when needed — not loaded by default.
