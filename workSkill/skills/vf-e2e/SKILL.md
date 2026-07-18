---
name: vf-e2e
description: "低成本前端业务闭环验证（vf 族）。根据代码业务逻辑走完一套正常流程（Trigger→Process→Data→Feedback）；写/复用最小 Playwright spec 再跑。证据优先 network+console；产物在 .verify/。发现问题不修复。Use when: vf-e2e, 验证业务流程, 走一遍正常流程, 业务验证, 写测试再跑, 回归验证, e2e verify。Not for: 修 bug(→vf-fix), 只看 git diff 当验证, 根目录装 playwright, 默认截图, 提交 .verify/。"
---

# vf-e2e

## Iron Law

**目标：按代码里的业务逻辑，走完一套「正常业务流程」闭环。写/复用最小 spec → 跑。不修代码。**

闭环四环缺一不可：`Trigger → Process → Data → Feedback`  
单独不算过：页面打开 / 能点 / 弹窗 / 接口 200。

**主线是 flow，不是 diff。** 从路由/页面/表单/API/状态推导「用户怎么完成这件事」；`git diff` 仅可选提示「可能波及哪条 flow」，禁止只因 diff 片段拼残缺断言。

证据优先级：`network → console → 文本/定位 → 截图(末手段,≤1张)`

**Spec 只断言闭环。诊断禁止进 spec → agent-browser / vf-fix。**

**Playwright 失败自修重跑 ≤2 次；仍 FAIL → 强制切 agent-browser；需改业务 → vf-fix。**

Red Flags：只扫 diff 不建模流程 · browser 走完全站当验证 · 顺便改业务代码 · 无确认猜成功标准 · 根目录装 Playwright · spec 塞诊断 log · Playwright 空转 >2 次

## Storage

目录 **`.verify/`**（整夹本地私有）。业务仓 `.gitignore`：`.verify/`

```text
.verify/
├── index.json / flows/ / knowledge/ / reports/
└── e2e/          # package.json, playwright.config.ts, specs/
```

```bash
cd .verify/e2e && npm i && npx playwright install chromium
cd .verify/e2e && npx playwright test specs/<name>.spec.ts
```

例外：项目已有官方 E2E → 复用其命令，只更新 index。禁止污染业务根依赖。

加载：`index → flow → 相关业务代码 → spec →（缺口）browser → 跑 → 报告`

## Workflow

```
vf-e2e Progress:
- [ ] Step 1: 读 .verify/index.json ⛔ BLOCKING — 定位相关 flow / spec / knowledge
- [ ] Step 2: 定业务主路径 — 读路由/页面/表单/提交/API/成功态代码，还原「正常走完」步骤（勿扫全库）
- [ ] Step 3: flow — 有则复用并对齐代码；无则问用户 ⚠️ → 写 flows/ + index
- [ ] Step 4: spec — 按 flow 写/改最小闭环用例（`.verify/e2e/specs/` 或已有 E2E 目录）；缺 selector/接口时 browser 只取样
- [ ] Step 5: 跑 Playwright（自修重跑 ≤2）
  - [ ] 5a PASS → reports/
  - [ ] 5b FAIL≤2 → 只改闭环断言/等待（禁诊断 log）再跑
  - [ ] 5c 仍 FAIL → browser 探测；改业务 → **vf-fix**；或 BLOCKED
- [ ] Step 6: FAIL/blocked 可沉淀 → **vf-mry**
```

可选：用户点名「这次改动」时，用 `git diff` **只辅助选哪条 flow**，仍须按完整业务路径验证。

Step 3 必问（无 flow 时）：实际怎么操作？期望成功长什么样？须避免什么？

Step 4：断言覆盖四环（操作→处理/请求→数据变化→用户反馈）；network/console 优先；禁大量 case / 默认 screenshot / 诊断 log。

Step 5c：可回写断言/等待；业务修复走 vf-fix。外部未就绪 → BLOCKED。

## 模板

```md
# 用户新增
目标: 创建一个用户
步骤: 1.打开新增 2.填写 3.提交
成功标准: 创建接口成功 · 数据保存 · 页面显示新数据
关联: user-form
spec: .verify/e2e/specs/user-create.spec.ts
```

```text
Flow: <name> | Spec: <path> | Result: PASS|FAIL|BLOCKED
Trigger/Process/Data/Feedback: 通过|失败|跳过
问题: <一句>
证据: <network/console/失败摘要>
探路: <browser 取了什么>
重跑: <Playwright N次；是否已切 browser/vf-fix>
```

## Anti-Patterns / Pre-Delivery

禁止：用 diff 片段代替完整业务流程 · browser 当验证完成 · 跳过 network/console 截图 · 提交 `.verify/` · 修业务代码 · spec 诊断 log · 空转 >2 次

- [ ] 验证的是完整正常业务路径，非「改动点冒烟」
- [ ] 主结果来自 Playwright；四环有断言
- [ ] FAIL 重跑≤2；超限已切 browser/vf-fix；spec 无诊断 log
- [ ] `.verify/` gitignore；未改业务代码；index 已更新
