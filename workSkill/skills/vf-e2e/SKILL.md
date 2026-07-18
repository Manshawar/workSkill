---
name: vf-e2e
description: "低成本前端业务闭环验证（vf 族）。按代码业务逻辑走完正常流程；真实 UI 操作；DOM/network 优先于 URL；禁 page.evaluate 模拟行为。产物在 .verify/。发现问题不修复。Use when: vf-e2e, 验证业务流程, 走一遍正常流程, 业务验证, 写测试再跑, 回归验证。Not for: 修 bug(→vf-fix), evaluate 兜底走通, 只看 git diff, 根目录装 playwright, 提交 .verify/。"
---

# vf-e2e

## Iron Law

**目标：按代码里的业务逻辑，走完一套「正常业务流程」闭环。写/复用最小 spec → 跑。不修代码。**

闭环四环缺一不可：`Trigger → Process → Data → Feedback`  
单独不算过：页面打开 / 能点 / 弹窗 / 接口 200。

**主线是 flow，不是 diff。** 从路由/页面/表单/API/状态推导「用户怎么完成这件事」；`git diff` 仅可选提示「可能波及哪条 flow」，禁止只因 diff 片段拼残缺断言。

证据优先级：`network → console → 文本/定位 → 截图(末手段,≤1张)`

**Spec 只断言真实 UI 行为。诊断禁止进 spec → agent-browser / vf-fix。**

**Playwright 失败自修重跑 ≤2 次；自修只许改等待/选择器/断言，禁止改「业务行为」。仍 FAIL → 先判 spec 错还是业务 bug → browser / vf-fix / BLOCKED。**

**交互必须像真用户：** `click` / `fill` / 真实控件。禁止 `page.evaluate` 调组件方法、`confirmFn`、`router.*`、改状态来「走通」。

**路由成功态：DOM 可见性优先于 URL 字符串**（嵌套/hash 路由下 URL 不可靠）。

Red Flags：evaluate 模拟用户/跳路由 · 只靠 URL 判成功 · 只扫 diff 不建模流程 · browser 走完全站当验证 · 顺便改业务代码 · spec 塞诊断 log · 空转 >2 次

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
  - [ ] 5b FAIL 第 1 次 → 先判 ⚠️：spec 写错还是业务 bug？
  - [ ] 5c spec 错 → 只改等待/选择器/DOM·network 断言再跑（禁 evaluate 兜底、禁诊断 log），累计 ≤2
  - [ ] 5d 业务 bug → **vf-fix**；都改不动 → BLOCKED + agent-browser 探测
- [ ] Step 6: FAIL/blocked 可沉淀 → **vf-mry**
```

可选：用户点名「这次改动」时，用 `git diff` **只辅助选哪条 flow**，仍须按完整业务路径验证。

Step 3 必问（无 flow 时）：实际怎么操作？期望成功长什么样？须避免什么？

Step 4：断言覆盖四环；操作=真实 UI；成功态看 DOM/network，不靠 URL 字符串；禁 evaluate 模拟行为 / 大量 case / screenshot / 诊断 log。

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

禁止：
- `page.evaluate` 模拟点击/跳转/改状态，或调用 Vue 组件方法（自欺欺人）
- 用 URL 字符串当路由成功依据（应用 DOM 可见）
- 自修时加 evaluate 探针 / console.log「看输出」当修复（看失败摘要/error-context）
- diff 冒烟代替完整流程 · 修业务代码 · 空转 >2 次不问分流

- [ ] 真实 UI 走完四环；无 evaluate 行为兜底；成功态 DOM/network 优先
- [ ] FAIL 已分流（spec / vf-fix / BLOCKED）；自修≤2 且只动等待/选择器/断言
- [ ] `.verify/` gitignore；未改业务代码；index 已更新
