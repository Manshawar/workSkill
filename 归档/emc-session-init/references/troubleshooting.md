# 故障排查

> 现象 → 原因 → 处理。先看 `/tmp/init-fail-*.png`。

UI 文案一律用 `ui.local.json` 键名，**不要**把真实 label 写进排查命令或贴进对话。AI **不读** `config.local.json` / `ui.local.json`。

## 目录

- [config/ui 读不到](#configui-读不到)
- [step 3b 假通过 / 仍停在 passport](#step-3b-假通过--仍停在-passport)
- [找不到 account 输入框](#找不到-account-输入框)
- [btnNext 无反应](#btnnext-无反应)
- [找不到组织](#找不到组织)
- [找不到 btnBackend](#找不到-btnbackend)
- [身份页没有「版块管理员」](#身份页没有版块管理员)
- [重开被踢回 passport](#重开被踢回-passport)
- [eapps 域 cookie 缺失](#eapps-域-cookie-缺失)
- [新标签页打不开](#新标签页打不开)

## config/ui 读不到

**原因**：
1. 缺 `ui.local.json` / `config.local.json`（无 example 回退；ui 必须本地自建）
2. 旧流程 `cp init.js /tmp/` → `__dirname` 错

**处理**：
1. 按 SKILL.md「首次配置」本地建两文件；键表在 SKILL
2. 原路径跑：`node run.js ../emc-session-init/scripts/init.js`
3. 可选：`EMC_SKILL_DIR=/abs/path/to/emc-session-init`

## step 3b 假通过 / 仍停在 passport

**症状**：日志 `✅ 3b ... ok`，但 `url after submit` 仍是 `.../passport/pc/...?redirect_uri=https%3A%2F%2Fwork-betacloud...`；随后 step 4 `waitForEvent('page')` 超时。

**原因（两层）**：
1. **断言 bug（已修）**：`waitForURL(/work-betacloud/)` 匹配**整段 URL 字符串**。`entryUrl` 的 query 里 `redirect_uri` 已含 `work-betacloud` → 人还在 passport 页也「通过」。
2. **SSO 实际未过**：accessKey / verifyToken 被拒、或前端校验失败 → 页面不跳转。AI **不读** secrets；请用户本地核对 `config.local.json`。

**正确断言**（init.js 已改）：

```javascript
await page.waitForURL(
  (url) => url.hostname.includes('work-betacloud') && !/passport/i.test(url.pathname),
  { timeout: 15000 },
);
if (/passport/i.test(page.url())) throw new Error('SSO submit failed, still on passport');
```

**处理**：
1. 确认用的是修好后的 `init.js`
2. 用户本地核对 `accessKey` / `verifyToken`（勿贴对话）
3. 失败看 `/tmp/init-fail-*.png`

## 找不到 account 输入框

**原因**：默认在扫码 tab；account 框在 `UI.tabAccount` 对应 tab 下。

**处理**：步骤 1 已点 `UI.tabAccount`。仍找不到 → DOM 可能变了。探 DOM 时用键名，别硬编码中文。优先用 `NODE_PATH` 直跑探针脚本，别 `require` 敏感 ui 进对话。

## btnNext 无反应

**原因**：页面上 `UI.btnNext` 按钮多个（account 步、verifyToken 步），或输入框未 ready。

**处理**：每步 `waitForSelector` 等对应 placeholder（`UI.phAccount` / `UI.phVerify`）再点。仍无反应 → 可能点到禁用态。加大 `slowMo`：`chromium.launch({ headless: false, slowMo: 200 })`。

## 找不到组织

**原因**：组织是 `<dd>`，不是 button / a。

**处理**：脚本用 `page.locator('dd', { hasText: CONFIG.org })`。换组织：`--org 'NAME'` 或 `EMC_ORG`。特殊字符注意 shell 引号。

## 找不到 btnBackend

**原因**：入口是 SPAN（非 a / button），且要等详情页加载完。若仍停在 passport，根本没有该按钮——先查 [step 3b 假通过](#step-3b-假通过--仍停在-passport)。

**处理**：
1. 确认 `page.url()` 的 **hostname** 已是 `work-betacloud`，且 pathname **不含** `passport`
2. 等 `networkidle` + `waitForTimeout`
3. 降级：`span` / `a` + `UI.btnBackend`

## 身份页没有「版块管理员」

**原因**：
1. 错别字：「版块」≠「板块」。
2. 账号未绑该 role。

**处理**：用 playwright 列出可见文本再选（URL 指 switch-identity 页）。

## 重开被踢回 passport

**原因**：session 过期 / storageState 未覆盖目标域。

**处理**：
1. `rm /tmp/emc-session.json`
2. 重跑 init（SKILL.md Step 2）
3. 必跑 Step 3 验证

## eapps 域 cookie 缺失

**原因**：存 storageState 时 eapps 页未加载完。

**处理**：步骤 6 前已有 `waitForTimeout(2000)`。仍缺 → 加到 4000ms，或 `waitForLoadState('networkidle')` 再存。验证见 `session-reuse.md`。

## 新标签页打不开

**原因**：`waitForEvent('page')` 超时。常见上游：SSO 没真正跳到 work（见 step 3b），或 `UI.btnBackend` 没点到，或弹窗被拦。

**处理**：
1. 先确认当前 URL hostname / pathname（不是 query 里有没有 work 字样）
2. 点击前确认 `UI.btnBackend` 可见
3. 调试用 `headless: false`
4. 新页应在 `eapps-betacloud` 域
