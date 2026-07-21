---
name: model-bench
description: "Bench OpenAI-compatible AI gateway models by streaming first-token latency and rank which is fastest now (错峰选模型). Fetches model list from GET /v1/models; measures POST /v1/chat/completions stream. CLI table or local HTML UI (suffix ui). Use when: 测模型速度, 模型测速, 首包延迟, 错峰用哪个模型, model bench, latency rank, 一键测速, model-bench ui, 打开测速页面. Not for: writing prompts for quality eval, non-OpenAI APIs, storing API keys in repo."
allowed-tools:
  - Bash(node **/model-bench/scripts/bench.js*)
  - Bash(node **/model-bench/scripts/server.js*)
  - Read(**/model-bench/**)
  - Read(**/.config/model-bench/**)
---

# model-bench

## Iron Law

**密钥与网关地址只来自环境变量；禁止写入仓库 / SKILL / 聊天回显真实 key；禁止在产物中出现客户/公司专有域名文案以外的硬编码主机名。缺 env 必须停并指导设置。**

```text
查 env → (缺则停+设 env) → /v1/models → 流式首包测速 → 排行/建议
用户说 ui → node scripts/bench.js ui（本地页一键测）
```

Red Flags（出现就停）：
- 把用户 key 写进 workspace / `.env` 进 git / 示例文件
- 用非流式或只比总耗时冒充「首包」
- 跳过 `/v1/models` 瞎编模型列表
- 在回复里完整打印 Bearer token

## Progress

```
model-bench Progress:

- [ ] Step 0: 解析模式 CLI | UI ⚠️ REQUIRED
- [ ] Step 1: 检查 AI_GATEWAY_* 环境变量 ⛔ BLOCKING
- [ ] Step 2: 跑脚本（CLI 或 UI）⚠️ REQUIRED
- [ ] Step 3: 输出排行 + 当前推荐 ⚠️ REQUIRED
- [ ] 交付前自检
```

## Env

| 变量 | 必填 | 说明 |
|---|---|---|
| `AI_GATEWAY_BASE_URL` | 是 | 网关根，如 `https://ai-gateway.example.com`（可已带 `/v1`） |
| `AI_GATEWAY_API_KEY` | 是 | Bearer Token |

历史结果（可选）：`~/.config/model-bench/history/*.json`（机器本地，不进 skill 包）

缺变量时：Load `references/env-setup.md`，按用户 OS 贴命令；**不要**让用户把真实 key 发回对话。

## Parameters

| 参数 | 默认 | 说明 |
|---|---|---|
| `ui` / `--ui` | off | 启动本地 HTML（`127.0.0.1:8787`） |
| `--port N` | 8787 | UI 端口 |
| `--rounds N` | 1 | 每模型轮数（UI 也可设，最大 5） |
| `--prompt TEXT` | 你好 | 探测用 user 消息 |
| `--sort ttft\|total` | total | 默认 total（等整轮结束再下一步）；ttft 看首包体感 |
| `--concurrency N` / `-c` | 6 | 最大同时测几个模型（防打爆主力） |
| `--stagger MS` | 1000 | 每个模型启动间隔；限流主要靠 concurrency |
| `--models a,b` | 全部 | 只测这些 id |
| `--exclude a,b` | — | 排除 |
| `--json` | off | CLI 输出 JSON |
| `--no-save` | off | 不写 history |

**argument-hint**: `[ui] [--port N] [--rounds N] [--prompt TEXT] [--sort ttft|total] [--concurrency N] [--stagger MS] [--models a,b] [--exclude a,b] [--json] [--no-save]`

## Step 0: 模式

- 用户带 **ui** / 「打开页面」/ 「可视化」→ UI 模式
- 否则 → CLI 模式

脚本目录：本 skill 下 `scripts/`（用绝对或相对 skill 根路径执行）。

## Step 1: env ⛔ BLOCKING

Ask: `AI_GATEWAY_BASE_URL` 与 `AI_GATEWAY_API_KEY` 是否已在**当前**进程可见？

快速检查（不要打印 key 内容）：

```bash
node -e "console.log({base:!!process.env.AI_GATEWAY_BASE_URL,keyLen:(process.env.AI_GATEWAY_API_KEY||'').length})"
```

若缺：Load `references/env-setup.md`，停。用户说「已设置」后再查；仍缺则请其重开终端/IDE。

## Step 2: 执行

### CLI

```bash
node scripts/bench.js
# 或
node scripts/bench.js --rounds 2 --json
```

### UI

```bash
node scripts/bench.js ui
# 等价: node scripts/server.js
```

启动后打开输出的 `http://127.0.0.1:8787/`。  
页面：进入拉 `/api/models` → 勾选 → **一键测速**（服务端读 env 代理，浏览器不持有 key）。

后台跑 UI 时告知用户 URL，并说明 Ctrl+C 结束。

## Step 3: 交付

必须包含：
1. 排行表含 **TTFT (s)** 与 **Total (s)**；默认按 **Total** 升序（`--sort ttft` 可改）
2. 一句推荐：`现在优先用 <model>（Total|TTFT x.xxs）`
3. 失败模型及原因（若有）

勿粘贴 Authorization 头或完整 key。不展示墙钟「结束时刻」作排序依据。

## Anti-Patterns

- 手写 curl 把 key 留在命令历史示例里发给用户（用 env 占位）
- 安装 Express/Vite 等重依赖（本 skill 仅 Node 原生）
- 因 CORS 让浏览器直连网关并塞 key
- 把公司内部主机名写进 SKILL/示例（示例一律 `example.com`）

## Pre-Delivery Checklist

- [ ] 未在任何文件/回复中写入真实 API key
- [ ] 测的是 **stream 首包 TTFT（秒）**（`delta.content` 首次非空）
- [ ] 模型列表来自 `/v1/models`（或用户显式 `--models`）
- [ ] 有排行（TTFT s）+ 当前推荐
- [ ] UI 模式已给出本地 URL
