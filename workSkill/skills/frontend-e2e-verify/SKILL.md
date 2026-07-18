---
name: frontend-e2e-verify
description: "低成本前端业务闭环验证：据代码写/复用最小 Playwright spec 再跑；证据优先 network+console，截图末手段；产物在本地 .verify/（gitignore）；agent-browser 仅探缺口。发现问题不修复。Use when: 验证一下这次改动, 业务验证, 写测试再跑, 回归验证, e2e verify, 检查业务闭环, AI 改完验一下。Not for: 修 bug, 根目录装 playwright, 默认截图, 提交 .verify/, browser 全量点流程。"
---

# Frontend E2E Verify

## Iron Law

**写/复用最小 spec → 跑测试。agent-browser 只取缺口信息。不修代码。**

闭环四环缺一不可：`Trigger → Process → Data → Feedback`  
单独不算过：页面打开 / 能点 / 弹窗 / 接口 200。

证据优先级：`network → console → 文本/定位 → 截图(末手段,≤1张)`

Red Flags：browser 走完全 flow · 顺便改业务代码 · 无确认猜成功标准 · 根目录装 Playwright / 写 spec · 未走完证据链就截图

## Storage

目录 **`.verify/`**（整夹本地私有）。业务仓 `.gitignore` 一行：`.verify/`

```text
.verify/
├── index.json / flows/ / knowledge/ / reports/
└── e2e/          # 独立包：package.json, playwright.config.ts, specs/
```

```bash
cd .verify/e2e && npm i && npx playwright install chromium
cd .verify/e2e && npx playwright test specs/<name>.spec.ts
```

例外：项目已有官方 E2E → 复用其命令，只更新 index 指向。禁止平行污染业务根依赖。

加载顺序：`index → flow/spec → knowledge →（缺口）browser 取样 → 跑 spec → 报告`

## Workflow

```
E2E Verify Progress:
- [ ] Step 1: git diff + 相关源码（路由/表单/API），勿扫全库
- [ ] Step 2: 读 .verify/index.json ⛔ BLOCKING
- [ ] Step 3: flow — 有则复用；无则问用户 ⚠️ → 写 flows/ + 更新 index
- [ ] Step 4: spec — 有则最小改；无则写 `.verify/e2e/specs/`；缺 selector/接口时 browser 只取样
- [ ] Step 5: 跑 Playwright → 四环判 PASS/FAIL → reports/
- [ ] Step 6: FAIL 可沉淀 → knowledge 或 frontend-repair-memory
```

Step 3 必问：实际操作？期望成功？需避免的问题？

Step 4 spec：四环断言；`waitForResponse` / console / status 优先于文案；禁止大量 case、禁止默认 screenshot。

## 模板

Flow（短）：

```md
# 用户新增
目标: 创建一个用户
步骤: 1.打开新增 2.填写 3.提交
成功标准: 创建接口成功 · 数据保存 · 页面显示新数据
关联: user-form
spec: .verify/e2e/specs/user-create.spec.ts
```

报告：

```text
Flow: <name> | Spec: <path> | Result: PASS|FAIL
Trigger/Process/Data/Feedback: 通过|失败
问题: <一句>
证据: <network/console/失败摘要；截图须注明为何必要>
探路: <若用 browser：取了什么>
```

## Anti-Patterns / Pre-Delivery

禁止：browser 当验证完成 · 只靠「看起来过了」· 跳过 network/console 截图 · 提交 `.verify/` · 修业务代码

- [ ] 主结果来自 Playwright 跑分；证据链遵守优先级
- [ ] `.verify/` 在 gitignore；未动业务根 package.json
- [ ] 未改业务代码；index 已更新
