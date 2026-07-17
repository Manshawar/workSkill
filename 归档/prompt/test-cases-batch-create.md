# 手工测试用例：EMC 知识库（SSO session + 批量新增主题）

> **纯静态生成**——依据 `auto-new-topic.md` 及 `scripts/batch-create-topics.js` 中的真实选择器与步骤产出，**不含接口测试、不含性能测试**。
> 用例聚焦 **UI 渲染点 + 交互点 + 输入边界值**，每条带「注释」（讲为什么测 + 易踩的坑）。
>
> | 项 | 值 |
> | --- | --- |
> | 对应入口 | [`auto-new-topic.md`](./auto-new-topic.md) |
> | Session 能力 | `emc-session-init` skill（跨域 storageState） |
> | 批量新增 | [`scripts/batch-create-topics.js`](./scripts/batch-create-topics.js) |
> | 测试范围 | UI 渲染 / 交互 / 输入边界值（**不含接口、性能**） |
>
> SSO 页面明文 label **不写进本文件**——读 `.claude/skills/emc-session-init/ui.local.json` 的键（`UI.tabAccount` / `UI.phAccount` / …）。填值读 `config.local.json`（`account` / `verifyToken` / `accessKey`），勿贴对话。

## 测试范围（做 / 不做）

| 维度 | 是否覆盖 | 说明 |
| --- | --- | --- |
| UI 渲染点 | ✅ | 元素存在 / 可见、默认态、切换态、弹窗开关、列表空/有数据 |
| 交互点 | ✅ | 点击→跳转/弹窗、表单→校验、提交→反馈、跨标签页/跨域、去重 |
| 输入边界值 | ✅ | 每个输入框套边界值清单（空 / 1 字 / 最大 / 超长 / 特殊字符…） |
| 接口测试 | ❌ | 不验证 HTTP 状态码 / 响应体 / 字段契约 |
| 性能测试 | ❌ | 不测响应时间 / 并发 / 内存 |

## 用例分组

| 组 | 前缀 | 内容 | 数量 |
| --- | --- | --- | --- |
| UI 渲染点 | `TC-UI-` | 渲染、可见性、文案、弹窗、列表 | 10 |
| 交互点 | `TC-IX-` | 点击、填写、提交、跳转、跨域、去重 | 11 |
| 输入边界值 | `TC-BV-` | 每个输入框套边界值清单 | 13 |
| 端到端串联 | `TC-E2E-` | 关键主路径串联 | 3 |

---

## 一、UI 渲染点（TC-UI-）

### TC-UI-01　SSO 入口默认渲染（扫码面板）

**测试点**：从 URL 直接打开 SSO 入口，默认是扫码面板，不是 account 面板。
**类型**：UI 渲染。
**前提**：无有效 session；网络可达 `user-betacloud.e.lanxin.cn`。
**步骤**：
1. 打开 `ENTRY_URL`（config `entryUrl`，含 `/passport/`）
2. 等待 `networkidle`
3. 截图 `/tmp/sso-1-entry.png`
**预期**：
- 页面标题为「蓝信用户中心」
- body 含扫码相关提示文案
- 存在二维码刷新入口 + `UI.tabAccount` 切换入口
- **不存在** `input[placeholder="${UI.phAccount}"]`
**注释**：⭐ init 步骤 1 必须先点 `UI.tabAccount`——默认面板没有 account 框，直接 `fill` 会超时。

### TC-UI-02　切换到 account 面板

**测试点**：点 `UI.tabAccount` 后面板切换，出现 account 输入框与国家区号下拉。
**类型**：UI 渲染。
**前提**：TC-UI-01 通过，停留在扫码面板。
**步骤**：
1. `page.locator('text=' + UI.tabAccount).first().click()`
2. 等 `input[placeholder="${UI.phAccount}"]` 可见
**预期**：
- 出现 `input[placeholder="${UI.phAccount}"]`
- 出现国家区号下拉（`placeholder="输入国家名/编码检索"`）
- 出现 `UI.btnNext` 按钮且可点击
**注释**：纯前端状态切换，不刷新。`UI.tabAccount` 是文本定位——若改成图标按钮，同步改 `ui.local.json`。

### TC-UI-03　account → verifyToken 步骤切换

**测试点**：填 `account` 点 `UI.btnNext` 后，切到 verifyToken 步骤，出现框与倒计时提示。
**类型**：UI 渲染。
**前提**：TC-UI-02 通过。
**步骤**：
1. 填 `account`（从 `config.local.json` / env 读，不写死用例）
2. 点 `button:has-text("${UI.btnNext}")`
3. 等 `input[placeholder="${UI.phVerify}"]`
**预期**：
- 出现 `input[placeholder="${UI.phVerify}"]`（`type=tel`）
- 出现脱敏回显 + 倒计时文案
- account 输入框不再可见
**注释**：脱敏回显可用于校验前端渲染。倒计时只断言「存在文案」，不做精确值。

### TC-UI-04　组织选择页渲染（dd 元素）

**测试点**：组织项是 `<dd>`（不是 button / a），且可列出多个组织。
**类型**：UI 渲染。
**前提**：TC-UI-03 通过。
**步骤**：
1. 检查 body 含 `UI.orgPrompt`
2. 统计 `dd` 含组织名的数量
**预期**：
- 出现 `UI.orgPrompt` 文案
- 至少 1 个 `<dd>` 组织项
**注释**：⭐ 用 `page.locator('dd', { hasText })`，勿用 `button:has-text`。

### TC-UI-05　accessKey 输入页渲染

**测试点**：点组织后出现 `input[type="password"]`，已选组织名回填。
**类型**：UI 渲染。
**前提**：TC-UI-04 通过。
**步骤**：
1. 点 `dd` 含 config `org`（默认「生态应用测试组织」）
2. 等 `input[type="password"]`
**预期**：
- 出现 `input[type="password"]`
- 组织 input 回显已选名
- 出现 `UI.btnSubmit`
**注释**：accessKey 框只在选完组织后出现——提前 fill 会超时。

### TC-UI-06　应用详情页渲染（含「前往后台」SPAN）

**测试点**：SSO 成功跳转后，应用详情页含「前往后台」入口。
**类型**：UI 渲染。
**前提**：TC-UI-05 通过。
**步骤**：
1. 填 `accessKey`，点 `UI.btnSubmit`
2. 等 `work-betacloud` 域 URL
3. 检查页面含 `UI.btnBackend`
**预期**：
- URL 跳到 `work-betacloud.e.lanxin.cn`
- 标题变为「蓝信-企业级安全移动工作平台」
- 存在 `UI.btnBackend` 入口
**注释**：⭐ 「前往后台」是 **SPAN**，不是 button / a。脚本用 `locator('text=' + UI.btnBackend)`。

### TC-UI-07　身份选择页渲染（版块管理员）

**测试点**：新标签页落在身份选择页，可见「版块管理员」。
**类型**：UI 渲染。
**前提**：TC-UI-06 通过。
**步骤**：
1. 点 `UI.btnBackend`
2. 等新标签页 `eapps-betacloud` 加载
3. 检查 URL 含 `switch-identity`
4. 检查页面含「版块管理员」
**预期**：
- 新标签页 URL 含 `eapps-betacloud` 且 hash 含 `switch-identity`
- 主标签页 URL 不变
- 身份选项含「版块管理员」
**注释**：⭐ 「**版块**」≠「板块」。`switch-identity` 只在首次跳转出现。

### TC-UI-08　身份确认后后台首页渲染（左侧菜单）

**测试点**：选完身份后后台首页左侧出现「知识库管理」。
**类型**：UI 渲染。
**前提**：TC-UI-07 通过。
**步骤**：
1. 点「版块管理员」
2. 等 `networkidle` + 2s
3. 检查左侧菜单
**预期**：
- URL 离开 `switch-identity`，进 `home-index/<id>`
- 顶部身份标识为「版块管理员」
- 左侧菜单出现「概况 / 知识库管理 / 公告管理」等
**注释**：`waitForTimeout(2000)` 给身份确认后加载留时间。菜单是 `<li>`，`filter({ hasText: '知识库管理' })`。

### TC-UI-09　知识库管理列表页渲染

**测试点**：进知识库管理后主题列表正常渲染（空 / 有数据）。
**类型**：UI 渲染。
**前提**：TC-UI-08 通过。
**步骤**：
1. 点 `li` 含「知识库管理」
2. 等 URL 命中 `topic-list|knowledge`
3. 检查列表表格结构
**预期**：
- URL 含 `topic-list`
- 表格渲染（空列表应有「暂无数据」，非白屏）
- 存在「新增主题」按钮（`button.el-button--primary`）
**注释**：空列表态常漏测——脚本靠「详情 编辑」文本判断稳定，空列表时 wait 可能被 `.catch()` 吞掉。

### TC-UI-10　新增主题 dialog 渲染

**测试点**：点「新增主题」后 dialog 弹出，四个字段齐全。
**类型**：UI 渲染。
**前提**：TC-UI-09 通过。
**步骤**：
1. 点 `button.el-button--primary` 含「新增主题」
2. 等 `textarea[placeholder="请输入主题描述"]`
3. 检查 dialog 内字段
**预期**：dialog 内含：
- 主题名称 `input[placeholder="请输入主题名称"]`
- 适用范围 `input[placeholder="点击选择适用范围"]`
- 排序 `input[type="number"][placeholder="数字越大排序越靠后"]`
- 主题描述 `textarea[placeholder="请输入主题描述"]`
- 取消 / 确定按钮
**注释**：用「主题描述 textarea」作 dialog 已开标志。排序脚本未填，人工测确认可填。

---

## 二、交互点（TC-IX-）

### TC-IX-01　「下一步」无反应（未填 account）

**测试点**：不填 account 直接点 `UI.btnNext`，应被前端校验拦截。
**类型**：交互。
**前提**：已切到 account 面板。
**步骤**：
1. 不填 account
2. 点 `button:has-text("${UI.btnNext}")`
**预期**：
- 不跳到 verifyToken 步骤
- account 框出现必填提示
**注释**：脚本永远先 fill 再点。人工测「漏填」分支。

### TC-IX-02　verifyToken 格式校验（非 6 位）

**测试点**：填非 6 位 verifyToken 点下一步，应被格式校验拦。
**类型**：交互。
**前提**：已到 verifyToken 步骤。
**步骤**：
1. 填 `123`（3 位）
2. 点 `UI.btnNext`
**预期**：不跳组织页，框出现格式错误提示。
**注释**：测前端格式前置，不是后端。后端属接口测试。

### TC-IX-03　点组织→出现 accessKey 框（dd 点击）

**测试点**：点 `<dd>` 后切到 accessKey 步骤。
**类型**：交互。
**前提**：TC-UI-04 通过。
**步骤**：
1. 点 `dd` 含 config `org`
2. 等 `input[type="password"]`
**预期**：password 框出现，组织名回填。
**注释**：dd 点击易写错。`hasText` 可能多命中，脚本用 `.first()`。

### TC-IX-04　「前往后台」→ 新标签页跨域

**测试点**：点 `UI.btnBackend` 后新标签页到 `eapps-betacloud`，主页不动。
**类型**：交互（跨标签页 / 跨域）。
**前提**：TC-UI-06 通过。
**步骤**：
1. `context.waitForEvent('page')` 挂监听
2. 点 `text=${UI.btnBackend}`
3. 拿新标签页，等 `networkidle`
**预期**：
- 新页 URL 含 `eapps-betacloud`，非 `about:blank`
- 主页 URL 不变
**注释**：⭐ 先挂 `waitForEvent` 再点。跨域 session 能否带过去是 TC-E2E 关键。

### TC-IX-05　选身份→离开 switch-identity

**测试点**：点「版块管理员」后 URL 离开 `switch-identity`。
**类型**：交互。
**前提**：TC-UI-07 通过。
**步骤**：
1. 点 `text=版块管理员`（第一个可见）
2. 等 `networkidle` + 2s
**预期**：URL 进 `home-index/<id>`，顶部身份标识变「版块管理员」。
**注释**：可能多匹配，挑第一个 `isVisible()`。

### TC-IX-06　进知识库管理（菜单点击→URL 跳转）

**测试点**：点左侧「知识库管理」`<li>` 后 URL 跳主题列表。
**类型**：交互。
**前提**：TC-IX-05 通过。
**步骤**：
1. `li` filter hasText「知识库管理」.click()
2. 等 URL 命中 `topic-list|knowledge`
**预期**：URL 含 `topic-list`，列表页渲染。
**注释**：菜单是 `li` 不是 `a`。URL 正则容错。

### TC-IX-07　选适用范围（readonly input + force click）

**测试点**：点「适用范围」readonly 框后弹组织树，可勾选分支。
**类型**：交互。
**前提**：新增主题 dialog 已开。
**步骤**：
1. `input[placeholder="点击选择适用范围"]`.click({ force: true })
2. 等 2s 树加载
3. 在 `.el-dialog.last()` 内勾 `getByRole('treeitem', { name: '测试' })`
4. 勾「研发」
5. 点该 dialog 的 `button:has-text("确 定")`
**预期**：
- 弹出范围 dialog
- 勾选后「确定」关闭范围 dialog
- 适用范围框回显所选
**注释**：⭐ (1) readonly 必须 `force: true`；(2) 「确 **定**」中间有空格；(3) 两个 dialog 叠层，用 `.el-dialog.last()`。

### TC-IX-08　未选适用范围直接提交

**测试点**：不选适用范围点「确定」，应被「请选择适用范围」拦。
**类型**：交互（必填校验）。
**前提**：dialog 已开，已填名称 + 描述，未选范围。
**步骤**：
1. 填名称 + 描述
2. 不选适用范围
3. 点 `button:has-text("确定")`
**预期**：dialog 不关，出现「请选择适用范围」，列表不新增。
**注释**：脚本默认勾「测试/研发」；本条专测漏勾。

### TC-IX-09　提交主题→dialog 关闭 + 列表刷新

**测试点**：填全字段 + 选范围 + 确定后，dialog 关、列表出现新主题。
**类型**：交互（提交反馈）。
**前提**：dialog 全字段已填。
**步骤**：
1. 点 `.el-dialog.first()` 的 `button:has-text("确定")`
2. 等 textarea `state: 'hidden'`
3. 等 1.2s 列表刷新
**预期**：dialog 关闭，列表新增一行。
**注释**：用 textarea hidden 判关闭。`.el-dialog.first()` 避开范围 dialog。

### TC-IX-10　重复名称去重（跳过已存在）

**测试点**：再建同名主题，应被去重跳过。
**类型**：交互（去重）。
**前提**：列表已存在某主题名。
**步骤**：
1. 脚本去重：抓 `td:nth-child(2)` + body，建 `existingNames` Set
2. 同名 → `continue` 跳过
**预期**：
- 日志 `跳过「xxx」（已存在）`
- 不打开新增 dialog
- 列表无重复行
**注释**：去重是「可反复跑」基石。人工测固定已知名验证跳过分支。

### TC-IX-11　session 失效→踢回 passport

**测试点**：session 过期时打开应用详情会被踢回 `/passport/`，脚本应抛错提示重跑。
**类型**：交互（异常态）。
**前提**：`/tmp/emc-session.json` 已失效。
**步骤**：
1. 用失效 session 打开 `APP_DETAIL_URL`
2. 检查 `page.url()` 是否含 `passport`
**预期**：URL 含 `passport`，脚本抛 `session 已失效，请重新跑 emc-session-init`。
**注释**：靠 URL 判失效——比等 401 更直接，快速失败。

---

## 三、输入边界值（TC-BV-）

> 每个输入框至少 3 条（空 / 最大 / 超长 优先）。值从 `config.local.json` 读，勿写进用例正文。

### 输入框 A：account（`UI.phAccount`）

#### TC-BV-01　account = 空

**测试点**：不填 account 点下一步。
**类型**：边界值。
**步骤**：不填 → 点 `UI.btnNext`。
**预期**：不跳步，必填提示。
**注释**：漏填分支。

#### TC-BV-02　account = 少于合法长度

**测试点**：填短于合法长度的 account。
**类型**：边界值。
**步骤**：填 10 位样例 → 点下一步。
**预期**：格式校验拦截。
**注释**：测前端格式前置，非后端。

#### TC-BV-03　account = 合法格式 + 未注册

**测试点**：格式对但未注册的 account。
**类型**：边界值。
**步骤**：填未注册样例 → 点下一步。
**预期**：能进 verifyToken 步，或提示未注册——以业务为准。
**注释**：区分「格式校验」与「账号存在性」两层。

### 输入框 B：verifyToken（`UI.phVerify`，`type=tel`，6 位）

#### TC-BV-04　verifyToken = 空

**测试点**：不填点下一步。
**类型**：边界值。
**步骤**：不填 → 点 `UI.btnNext`。
**预期**：不跳组织页，必填提示。
**注释**：空值仍应被前端拦。

#### TC-BV-05　verifyToken = 非 6 位

**测试点**：填 5 位或 7 位。
**类型**：边界值。
**步骤**：填错误长度 → 点下一步。
**预期**：格式校验拦截。
**注释**：`type=tel` 只收数字；6 位硬约束。

#### TC-BV-06　verifyToken = 6 位但错误值

**测试点**：填非测试环境特例的 6 位。
**类型**：边界值。
**步骤**：填 `999999` → 点下一步。
**预期**：被拒，不进组织页。
**注释**：确认测试环境特例不是默认。

### 输入框 C：accessKey（`input[type="password"]`）

#### TC-BV-07　accessKey = 空

**测试点**：不填点 `UI.btnSubmit`。
**类型**：边界值。
**步骤**：不填 → 点 `UI.btnSubmit`。
**预期**：不跳转，必填提示。
**注释**：空值不应发起提交。

#### TC-BV-08　accessKey = 错误值

**测试点**：填错误 accessKey 点提交。
**类型**：边界值。
**步骤**：填错误样例 → 点 `UI.btnSubmit`。
**预期**：不跳 `work-betacloud`，出现错误提示。
**注释**：会真实尝试提交，频次高可能触发风控——人工测一次即可。

### 输入框 D：主题名称 `input[placeholder="请输入主题名称"]`（maxlength=20）

#### TC-BV-09　主题名称 = 空

**测试点**：不填名称直接提交。
**类型**：边界值。
**前提**：新增主题 dialog 已开。
**步骤**：不填名称，选范围 + 填描述 → 点确定。
**预期**：dialog 不关，名称框必填提示，列表不新增。
**注释**：业务必填。测漏填分支。

#### TC-BV-10　主题名称 = 恰好 20 字（最大长度）

**测试点**：填 20 字名称。
**类型**：边界值。
**步骤**：粘 20 字符 → 提交。
**预期**：接受，列表出现 20 字主题。
**注释**：maxlength=20；刚好 20 应通过。

#### TC-BV-11　主题名称 = 21 字（超长）

**测试点**：粘 21 字名称。
**类型**：边界值。
**步骤**：粘 21 字符 → 观察框内实际长度 → 提交。
**预期**：框内只保留前 20 字（前端截断），提交存 20 字。
**注释**：⭐ maxlength 静默截断——最该测的边界。

#### TC-BV-12　主题名称 = 特殊字符

**测试点**：名称含 emoji / `<script>` / 引号 / 换行。
**类型**：边界值。
**步骤**：填 `测试<script>alert(1)</script>😀` → 提交 → 查列表回显。
**预期**：不崩，列表回显原样文本（不执行脚本、不乱码）。
**注释**：只测前端表现层；后端净化属接口/安全测试。

### 输入框 E：主题描述 `textarea[placeholder="请输入主题描述"]`

#### TC-BV-13　主题描述 = 空值

**测试点**：不填描述，填名 + 选范围直接提交。
**类型**：边界值。
**步骤**：不填描述 → 点确定。
**预期**：以业务为准——非必填则成功；必填则拦截。
**注释**：脚本每次都填描述；人工确认必填性。

---

## 四、端到端串联（TC-E2E-）

> 只铺关键主路径。

### TC-E2E-01　无 session → init → 批量新增 10 条

**测试点**：从零跑完整：`emc-session-init` 建 session → batch-create 新增 10 条。
**类型**：端到端。
**前提**：`/tmp/emc-session.json` 不存在。
**步骤**：
1. 跑 `emc-session-init`（`scripts/init.js`，覆盖三域）
2. 跑 `batch-create-topics.js`（10 条随机名）
**预期**：session 文件生成（user/work/eapps），10 条全部创建成功。
**注释**：session 是两子流程唯一握手点——跨域 cookie 齐全才能进 batch-create。

### TC-E2E-02　复用 session → 直接批量新增

**测试点**：session 已存在时跳过 init，直接 batch-create。
**类型**：端到端。
**前提**：TC-E2E-01 通过，session 有效。
**步骤**：直接跑 `batch-create-topics.js`。
**预期**：跳过 init，直接进列表页新增（随机名不撞库）。
**注释**：batch-create 开头有 `/passport/` 失效检测——有效时不应触发。

### TC-E2E-03　session 失效 → 删 session 重跑

**测试点**：session 过期后，删文件重跑 E2E-01。
**类型**：端到端（异常恢复）。
**前提**：session 已过期。
**步骤**：
1. `rm /tmp/emc-session.json`
2. 重跑 TC-E2E-01
**预期**：batch-create 检测到无 session → 提示先跑 `emc-session-init` → 重跑后恢复。
**注释**：测失败可重试。配合 TC-IX-10 去重，重跑不产生重复数据。

---

## 关键选择器参考表

### SSO（读 `ui.local.json`，勿把明文写进对话）

| 键 / 选择器 | 用途 | 备注 |
| --- | --- | --- |
| `UI.tabAccount` | 切扫码 → account 面板 | 默认扫码需先切 |
| `UI.phAccount` | account 输入 placeholder | 切 tab 后才出现 |
| `UI.phVerify` | verifyToken placeholder | `type=tel`，6 位 |
| `UI.orgPrompt` | 组织选择提示文案 | — |
| `dd` hasText config `org` | 组织选择 | **是 dd，不是 button** |
| `input[type="password"]` | accessKey 输入 | 选完组织才出现 |
| `UI.btnNext` | 下一步按钮 | — |
| `UI.btnSubmit` | 提交按钮 | — |
| `UI.btnBackend` | 跳后台（新标签页） | **是 SPAN** |

### 知识库业务页

| 选择器 | 用途 | 备注 |
| --- | --- | --- |
| `text=版块管理员` | 选身份 | **版块，不是板块** |
| `li` filter hasText「知识库管理」 | 进知识库管理 | 菜单项是 li |
| `button.el-button--primary` hasText「新增主题」 | 打开新增 dialog | 用 class 避开 svg |
| `input[placeholder="请输入主题名称"]` | 主题名称 | maxlength=20 |
| `input[placeholder="点击选择适用范围"]` | 适用范围入口 | **readonly，需 force click** |
| `.el-dialog.last()` `getByRole('treeitem', {name:'测试'})` | 勾选组织 | **避开 hasText 嵌套** |
| `button:has-text("确 定")` | 关范围 dialog | **中间有空格** |
| `.el-dialog.first()` `button:has-text("确定")` | 提交主题 | first() 限定新增 dialog |
| `textarea[placeholder="请输入主题描述"]` state hidden | 等 dialog 关 | 比等按钮消失稳 |

## 交付前自检

- [x] 每个输入框至少 3 条边界值（account 3 / verifyToken 3 / accessKey 2 / 主题名 4 / 描述 1）。
- [x] 每条用例都有「注释」字段，讲为什么测 + 踩坑。
- [x] `TC-UI / TC-IX / TC-BV / TC-E2E` 四组齐全。
- [x] 全文无接口测试、无性能测试用例。
- [x] SSO 选择器引用 `UI.*` 键，与 `emc-session-init` 一致；业务选择器与 `batch-create-topics.js` 一致。
- [x] 预期可肉眼 / 可截图判定，无「功能正常」空话。
- [x] 文末附「关键选择器参考表」。
- [x] 无 `emc-auto-login` / `auto-login.js` 旧名。

## 范围声明

本用例**只覆盖**：UI 渲染点、交互点、输入边界值。
**不覆盖**：HTTP 接口契约、响应状态码、字段级校验（接口测试）；响应时间、并发、内存（性能测试）；自动化脚本本身的稳定性（脚本自测）。
