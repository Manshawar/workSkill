---
name: emc-session-init
description: EMC test-env SSO session bootstrap (playwright-skill). Trigger when user opens app URL and hits SSO gate, or says「自动初始化 session」「走一遍 SSO」「保存 session 下次免初始化」「进入 XX 后台」「EMC storage 失效重跑」；also when playwright-skill / hand-test-cases stuck behind SSO or cannot enter backend. Flow uses config.local.json + ui.local.json (both gitignored). Before Bash/init remind user to leave auto mode for security confirm. NEVER paste secrets or ui.local labels into chat.
---

# EMC Session Init

> Compress「open app → SSO gate → manual walk」into one command; persist cross-domain session for later scripts.
> Test env only. Depends on `playwright-skill`.

## ⚠ 跑之前先提醒用户：关 auto

公司安全分类器对 `Bash` / `node` / playwright **全模式禁止**（报错常伪装成 `temporarily unavailable`）。本 skill 的 init / 验证 **必须执行命令**。

**每次调用本 skill、准备跑脚本前，AI 必须先告诉用户：**

1. 接下来要跑浏览器初始化，会触发安全确认
2. 请 **关闭 auto 模式**（`Shift+Tab` → 普通 / `accept-edits`），以便逐步确认执行
3. 若仍被公司分类器拦 → 只能用户终端亲自跑下面命令（AI 不得假装「等会儿再试」）

未完成此提醒，**禁止**直接 `Bash`。

## IRON LAW

### 1. Secrets never enter the repo

| 文件 | 角色 | 进仓库？ |
| --- | --- | --- |
| `config.local.json` | `account` / `verifyToken` / `accessKey` + 入口默认值 | ❌ gitignore |
| `ui.local.json` | SSO 流程各步 **按钮 / placeholder 文案**（选择器用） | ❌ gitignore |
| `config.example.json` | 脱敏模板（空 secrets + 非敏感默认） | ✅ |

**`ui.local.json` = 敏感凭证级文件**（不是可分享文档）：

- 含真实页面文案，进 API / 聊天会撞敏感词；进 git 等于泄露流程指纹
- **禁止上传**、禁止贴对话、禁止 Read 进上下文
- 调用本 skill 时 AI **必须确保** 已写入 `.gitignore`（见 Step 0）

Missing required fields → script **exits immediately**（no silent fallback）.

### 2. AI MUST NOT read sensitive files — scripts only ⛔

**Forbidden for AI**：

| File | Why |
| --- | --- |
| `config.local.json` | real account fields |
| `ui.local.json` | real SSO labels |
| `/tmp/emc-session.json` | cookie / session |

**Allowed**：`SKILL.md`、`config.example.json`、`scripts/*.js`、`references/*`

AI 只 `test -f` 查存在 → 用户确认关 auto → 跑脚本 → 看脱敏 stdout。

## When to use

- User hits SSO gate / 要初始化 session / 进后台
- `playwright-skill` / `hand-test-cases` 卡门禁时回调

**Not for**: production；非 EMC SSO；原生 App。

## 报告规则（脱敏）⛔

| 可说 | 禁止说 |
| --- | --- |
| 步骤 ok/fail、hostname 是否离开 passport | account / verifyToken / accessKey 真值 |
| session 路径是否生成 | `ui.local.json` 任何明文 |
| `/tmp/init-fail-*.png` | 原样转发未打码 stdout |

## Workflow

```
EMC Session Init Progress:

- [ ] Step 0: gitignore + 提醒关 auto ⚠️ REQUIRED
- [ ] Step 1: confirm config + ui ⚠️ REQUIRED
- [ ] Step 2: run init ⚠️ REQUIRED（用户已关 auto / 可确认）
- [ ] Step 3: verify session ⚠️ REQUIRED
- [ ] Step 4: reuse instructions
```

### Step 0: gitignore + 关 auto 提醒 ⚠️ REQUIRED

**A. 确保敏感文件在 gitignore**（每次调用都查，缺则追加；不读文件内容）：

```bash
GI=.gitignore
need() { grep -qxF "$1" "$GI" 2>/dev/null || echo "$1" >> "$GI"; }
need '.claude/skills/emc-session-init/config.local.json'
need '.claude/skills/emc-session-init/ui.local.json'
```

**B. 口头提醒用户**（原文大意即可）：

> 接下来要执行浏览器 SSO 初始化，需要安全确认。请先 **关闭 auto 模式**，再允许运行命令。  
> `ui.local.json` / `config.local.json` 是本地敏感文件，已加入 gitignore，**不要上传、不要贴到聊天**。

### Step 1: confirm config + ui ⚠️ REQUIRED

```bash
test -f .claude/skills/emc-session-init/config.local.json && \
test -f .claude/skills/emc-session-init/ui.local.json && echo ready
```

- 缺文件 → 指引用户按下方「首次配置」本地创建（AI **不** Write 真值进这两个文件；不打开已有文件）
- 已存在 → 进 Step 2

User 贴的 URL → `--entry-url`。

### Step 2: run init ⚠️ REQUIRED

确认用户已关 auto（或已知晓需人工确认）后再跑。

```bash
cd .claude/skills/playwright-skill && \
  node run.js ../emc-session-init/scripts/init.js
```

禁止 `cp init.js /tmp/`。透传：`node run.js ../emc-session-init/scripts/init.js -- --entry-url 'URL'`。

### Step 3: verify session ⚠️ REQUIRED

Load `/tmp/emc-session.json`，打开目标 URL，pathname 含 `passport` → 失效，重跑 Step 2。

### Step 4: reuse

告诉用户 session 路径 + `references/session-reuse.md`；勿复述 secrets。

---

## 首次配置（用户本地做，AI 不读内容）

### 1) `config.local.json`

```bash
cp .claude/skills/emc-session-init/config.example.json \
   .claude/skills/emc-session-init/config.local.json
# 按 config.example.json 里 _step* 注释填空字段
```

### 2) `ui.local.json`（无 example 文件——按表自建）

在 skill 目录新建 `ui.local.json`，键如下。值 = SSO 页 **可见原文**（DevTools 复制），**不要**发给 AI：

| 键 | 对应流程步 | 填什么 |
| --- | --- | --- |
| `tabAccount` | 步骤 1 | 切换到「账号方式」的 tab 文案 |
| `phAccount` | 步骤 2a | account 输入框的 placeholder |
| `phVerify` | 步骤 2b | verifyToken 输入框的 placeholder |
| `orgPrompt` | 步骤 2b→3 | 选组织页的提示文案 |
| `btnNext` | 步骤 2a / 2b | 「下一步」类按钮文案 |
| `btnSubmit` | 步骤 3b | 提交 accessKey 的按钮文案 |
| `btnBackend` | 步骤 4 | 进入后台的入口文案（常为 SPAN） |

骨架（用户本地存盘，值自己填）：

```json
{
  "tabAccount": "",
  "phAccount": "",
  "phVerify": "",
  "orgPrompt": "",
  "btnNext": "",
  "btnSubmit": "",
  "btnBackend": ""
}
```

> 再次强调：`ui.local.json` 与 `config.local.json` 同级敏感。**勿上传、勿提交、勿贴聊天。** Skill 调用时会自动确保 gitignore。

## Params

Priority: **CLI > env > config.local.json > config.example.json**.

| Field | CLI | Env | JSON key | Note |
| --- | --- | --- | --- | --- |
| account | `--account` | `EMC_ACCOUNT` | `account` | required |
| accessKey | `--access-key` | `EMC_ACCESS_KEY` | `accessKey` | required |
| verifyToken | `--verify-token` | `EMC_VERIFY_TOKEN` | `verifyToken` | required |
| entryUrl | `--entry-url` | `EMC_ENTRY_URL` | `entryUrl` | 用户 URL 优先 |
| org | `--org` | `EMC_ORG` | `org` | `<dd>` 文本 |
| role | `--role` | `EMC_ROLE` | `role` | 「版块」not「板块」 |
| session | `--session-out` | `EMC_SESSION_FILE` | `session` | default `/tmp/emc-session.json` |

## Anti-patterns

- ❌ 未提醒关 auto 就直接 Bash
- ❌ AI 读 / 上传 / 粘贴 `config.local.json` / `ui.local.json`
- ❌ 忘记把两文件写入 `.gitignore`
- ❌ `cp init.js /tmp/` 再跑
- ❌ `waitForURL(/work-betacloud/)` 整串匹配（query 假通过）
- ❌ 跳过 Step 3 验证 / 跳过 `waitForEvent('page')`

## Troubleshooting

`/tmp/init-fail-*.png` → `references/troubleshooting.md`

## References

| Topic | Path |
| --- | --- |
| Fail matrix | `references/troubleshooting.md` |
| Session reuse | `references/session-reuse.md` |
