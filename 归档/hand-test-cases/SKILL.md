---
name: hand-test-cases
description: 根据 playwright-skill 刚跑完的浏览器自动化流程（步骤日志 / 选择器 / 截图 / 脚本），产出一份纯手工功能测试用例文档。范围只做 UI 渲染点 + 交互点 + 输入边界值，不做接口测试、性能测试、自动化脚本。触发场景：playwright-skill 一轮测试跑完后「帮我出手工测试用例」「给这个流程补测试用例，要带注释」「做一下边界值 + UI 交互测试用例」「生成测试用例，不要接口、不要性能」「按手工测的角度列一下这个流程的测试点」。关键词：手工测试用例、测试用例、边界值、UI 交互、功能测试点、test case。配套：playwright-skill；卡门禁 / 进不去后台时前置写调 emc-session-init（脱敏，勿贴 secrets）。
---

# 手工测试用例生成

playwright-skill 跑完一轮浏览器自动化后，把流程产物（步骤序列、选择器、截图、脚本）转成**人工怎么测**的文档。不是出自动化脚本，不是接口测试，不是性能测试。

IRON LAW: 每条用例必须带「注释」字段，且注释讲的是"为什么测 + 易踩的坑"，不是复述步骤。没有注释的用例不合格。

配套 skill：
- 浏览器跑流程 → `playwright-skill`（完整脚本原路径 spawn，勿 `cp` 到 `/tmp` 再跑）
- EMC SSO session → `emc-session-init`（AI 不读 `config.local.json` / `ui.local.json`）

## 进不去后台 / 流程卡在门禁时

出用例过程中若发现（或上下文显示）以下情况，**用例里写清「前置：先跑 `emc-session-init`」**，并提示执行方去调该 skill——**不要**在用例正文展开 SSO 填表细节或贴 secrets：

- 被踢回 `/passport/`
- session 缺失 / 失效
- 进不了后台、无权限门、SSO 拦截

用例步骤只写：

1. 确认 `/tmp/emc-session.json` 存在（`test -f`）
2. 否则执行 `emc-session-init`（原路径 `node run.js ../emc-session-init/scripts/init.js`）
3. 再用 `storageState` 进后台继续测

注释可写踩坑：「卡门禁先 init，别在用例里复制 account/accessKey」。**禁止**把真实 label / secrets 写进用例文件。

## 测试范围（做 / 不做）

| 维度 | 是否覆盖 | 说明 |
| --- | --- | --- |
| UI 渲染点 | ✅ 做 | 元素存在 / 可见、默认态、切换态、文案、弹窗开关、列表空 / 有数据 |
| 交互点 | ✅ 做 | 点击→跳转 / 弹窗、表单填写→校验、提交→反馈、跨标签页 / 跨域、去重 / 跳过 |
| 输入边界值 | ✅ 做 | 每个输入框逐项套边界值清单（空 / 1 字符 / 最大长度 / 超长 / 特殊字符…） |
| 接口测试 | ❌ 不做 | 不验证 HTTP 状态码 / 响应体 / 字段契约——交给接口测试 |
| 性能测试 | ❌ 不做 | 不测响应时间 / 并发 / 内存——交给压测 |
| 自动化脚本 | ❌ 不做 | 本 skill 只出"人工怎么测"，不产出可跑脚本 |

## Workflow

Copy this checklist and check off items as you complete them:

```
Hand Test Cases Progress:

- [ ] Step 1: 收集流程产物 ⛔ BLOCKING
  - [ ] 1.1 从上下文拿步骤序列 / 选择器 / 截图 / 脚本路径
  - [ ] 1.2 上下文不足 → 让用户补（重跑 playwright-skill 或指脚本路径）
- [ ] Step 2: 确认范围与输出位置 ⚠️ REQUIRED
  - [ ] 确认流程名 → 输出文件名
  - [ ] 确认四个组都要（E2E 可少）
- [ ] Step 3: 按组生成用例
  - [ ] 3.1 UI 渲染组（TC-UI-）→ Load references/test-point-checklists.md
  - [ ] 3.2 交互组（TC-IX-）→ 同上
  - [ ] 3.3 边界值组（TC-BV-）→ Load references/boundary-value-checklist.md
  - [ ] 3.4 端到端串联组（TC-E2E-，少量主路径，不铺满）
- [ ] Step 4: 交付前自检 + 输出
```

## Step 1: 收集流程产物 ⛔ BLOCKING

本 skill 在「playwright-skill 刚跑完一轮」时使用，上下文里通常已有这些信息——逐项确认，缺哪补哪：

| 输入 | 来源 | 用途 |
| --- | --- | --- |
| 步骤序列 | playwright-skill 跑出的 `▶ 步骤 N` 日志 | 拆用例骨架 |
| 关键选择器 | 脚本里 `locator(...)` / `getByRole(...)` | 写「操作步骤」要引用的定位 |
| 输入框约束 | `placeholder` / `maxlength` / `type` / DOM 探针 | 套边界值清单 |
| 截图 | `/tmp/*.png` | 确认 UI 渲染点预期 |

若上下文不足（比如只给了一句需求没跑流程）：**先让用户重跑一遍 playwright-skill，或直接读流程脚本里的选择器注释**，不要凭空捏造选择器。

## Step 2: 确认范围与输出位置 ⚠️ REQUIRED

跟用户确认：

- 流程名 → 默认输出 `prompt/test-cases-<流程名>.md`（如 `test-cases-batch-create.md`）；用户指定则用用户的
- 四个组都要生成吗？E2E 组可省
- 上下文够不够（Step 1 缺的项是否已补）

⚠️ 范围已由 Iron Law 和测试范围表锁定，不需要问"要不要接口测试"——明确不做。这步只确认输出与遗漏，不重新谈范围。

## Step 3: 按组生成用例

四组齐全（E2E 可少）。每组都用下面的用例模板。

| 组 | 前缀 | 内容 |
| --- | --- | --- |
| UI 渲染点 | `TC-UI-` | 渲染、可见性、文案、弹窗、列表 |
| 交互点 | `TC-IX-` | 点击、填写、提交、跳转、跨域 |
| 输入边界值 | `TC-BV-` | 每个输入框套边界值清单 |
| 端到端串联 | `TC-E2E-` | 少量关键主路径串联（不铺满） |

- 3.1 / 3.2 → Load `references/test-point-checklists.md` 挑相关项列成用例
- 3.3 → Load `references/boundary-value-checklist.md` 对每个输入框逐行套用，每个输入框至少 3 条（空 / 最大 / 超长优先）
- 3.4 → 只挑关键主路径，不铺满
- 拿不准「注释」写多深、预期怎么算可判定 → Load `references/example-test-case.md`

### 用例模板（每条必须含以下字段）

```markdown
## TC-<组>-<编号>　<用例标题>

**测试点**：一句话说清"测什么"。
**类型**：UI 渲染 / 交互 / 边界值 / 端到端（选一）。
**前提**：依赖哪条用例已通过 / 哪个前置状态。
**步骤**：
1. `page.<操作>(...)`（引用真实选择器）
2. ...
**预期**：可肉眼 / 可截图判定的客观结果，不要"功能正常"这种空话。
**注释**：⭐ 强制——说明【为什么测这条】+【易踩的坑】。
```

## Step 4: 交付前自检 + 输出

逐项过完再写文件：

- [ ] 每个输入框至少 3 条边界值用例（空 / 最大 / 超长）。
- [ ] 每条用例都有「注释」字段，且注释讲的是"为什么测 + 踩坑"，不是复述步骤。
- [ ] `TC-UI / TC-IX / TC-BV / TC-E2E` 四组齐全（E2E 可少）。
- [ ] 全文无接口测试、无性能测试用例。
- [ ] 操作步骤里引用的选择器与真实脚本一致（可对照流程脚本）。
- [ ] 预期结果可肉眼 / 可截图判定，无"功能正常"空话。
- [ ] 文末附「关键选择器参考表」（列出本流程用到的关键选择器 + 踩坑备注）。

输出默认写到 `prompt/test-cases-<流程名>.md`。

## Anti-Patterns（不要这么做）

- ❌ 验证接口返回码 / 响应体字段——这是接口测试，不在范围。
- ❌ 测响应时间 / 并发数 / 内存——这是性能测试。
- ❌ 产出可执行自动化脚本——只出"人工怎么测"。
- ❌ 用例不带「注释」字段。
- ❌ 预期写"功能正常 / 页面正常"——要写成可判定的事实（标题=「蓝信用户中心」、`input[...]` 不存在）。
- ❌ 边界值只测 happy path（正常值）——边界值组本意就是异常与临界。
- ❌ 把"页面打开成功"当成唯一断言——要落到具体元素 / 文案 / URL。
- ❌ 凭空捏造选择器——必须从流程脚本 / 步骤日志里引用真实的。
- ❌ **URL 断言只写「字符串含某某域名」**——`redirect_uri` query 里常已含目标域名，人还在 passport 页也会「通过」。预期应写清：**hostname** 是目标域，且 **pathname 不含** `/passport/`（对照 `emc-session-init` step 3b 踩坑）。
- ❌ **把 `emc-auto-login` / `cp …/tmp/ + run.js` 写进用例步骤**——现用 `emc-session-init`，原路径 `node run.js ../emc-session-init/scripts/init.js`。
- ❌ 用例或注释里贴 secrets / `ui.local.json` 明文 label——写 `UI.*` / `account` / `accessKey` 键名即可。
- ❌ 卡在 SSO / 进不去后台时，在用例里手写填表步骤代替 `emc-session-init`——应写「调 init skill」前置。
