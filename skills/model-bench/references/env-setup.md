# Env setup (model-bench)

Load when `AI_GATEWAY_BASE_URL` or `AI_GATEWAY_API_KEY` is missing.

**Never ask the user to paste the real key back into chat.** Give commands with placeholders only.

## Required env

| Name | Example | Meaning |
|---|---|---|
| `AI_GATEWAY_BASE_URL` | `https://ai-gateway.example.com` | Gateway origin (script appends `/v1`) |
| `AI_GATEWAY_API_KEY` | `(your token)` | Bearer token |

Also accept base already ending with `/v1`.

## macOS / Linux

```bash
echo 'export AI_GATEWAY_BASE_URL="https://ai-gateway.example.com"' >> ~/.zshrc   # bash: ~/.bashrc
echo 'export AI_GATEWAY_API_KEY="YOUR_KEY"' >> ~/.zshrc
source ~/.zshrc
echo ${#AI_GATEWAY_API_KEY}   # length only; must be > 0
```

Re-open the IDE / Agent session so the new env is visible.

## Windows PowerShell (persistent)

```powershell
[System.Environment]::SetEnvironmentVariable("AI_GATEWAY_BASE_URL", "https://ai-gateway.example.com", "User")
[System.Environment]::SetEnvironmentVariable("AI_GATEWAY_API_KEY", "YOUR_KEY", "User")
```

Close and reopen the terminal / Cursor, then:

```powershell
if ($env:AI_GATEWAY_API_KEY) { "ok len=$($env:AI_GATEWAY_API_KEY.Length)" } else { "missing" }
```

## Windows CMD (current window only)

```bat
set AI_GATEWAY_BASE_URL=https://ai-gateway.example.com
set AI_GATEWAY_API_KEY=YOUR_KEY
```

## After setup

User replies「已设置」→ re-check env via `node scripts/bench.js` or UI `/api/health`.  
If still missing: the Agent process was started before export — ask them to restart Cursor/terminal.
