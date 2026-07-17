# agent-browser (loopfix conventions)

Official CLI only — `agent-browser skills get core`. loopfix **不**替代 agent-browser。

## Sticky session（跨对话复用）

`browser_env.js` / `run_workflow.js` 自动处理。Ad-hoc 调试时先拿 flags：

```bash
node <loopfix>/scripts/browser_env.js --cwd <project>
# 用 JSON 里的 flags / open_example / relay_login
```

规则：
- 同 worktree → `session id --scope worktree --prefix claude` + `--restore --headed`
- 禁止 `close` / `close --all`（除非用户明确要求）
- 禁止裸 `agent-browser open`（冷启动 / 丢登录）
- 默认 `snapshot -i`

## 路径

- Happy path: `run_workflow.js`（session 内置）
- Step 6 调试: `references/agent-browser-cli.md`
- CLI 缺失: `run_workflow.js` 返回 `AGENT_BROWSER_MISSING` + `install` → 转给用户
