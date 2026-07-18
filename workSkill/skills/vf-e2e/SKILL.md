---
name: vf-e2e
description: "低成本前端业务闭环验证（vf 族）。据代码写/复用最小 Playwright spec 再跑；证据优先 network+console；产物在 .verify/。发现问题不修复。Use when: vf-e2e, 验证一下这次改动, 业务验证, 写测试再跑, 回归验证, e2e verify, AI 改完验一下。Not for: 修 bug(→vf-fix), 根目录装 playwright, 默认截图, 提交 .verify/。"
---

# vf-e2e

## Iron Law

**写/复用最小 spec → 跑测试。agent-browser 只取缺口信息。不修代码。**

闭环四环缺一不可：`Trigger → Process → Data → Feedback`  
单独不算过：页面打开 / 能点 / 弹窗 / 接口 200。

证据优先级：`network → console → 文本/定位 → 截图(末手段,≤1张)`

**Spec 只断言闭环。诊断禁止进 spec → agent-browser / vf-fix。**

**Playwright 失败自修重跑 ≤2 次；仍 FAIL → 强制切 agent-browser；需改业务 → vf-fix。**

Red Flags：browser 走完全 flow · 顺便改业务代码 · 无确认猜成功标准 · 根目录装 Playwright · 未走完证据链就截图 · spec 塞诊断 log · Playwright 空转 >2 次

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

加载：`index → flow/spec → knowledge →（缺口）browser → 跑 spec → 报告`

## Workflow

```
vf-e2e Progress:
- [ ] Step 1: git diff + 相关源码，勿扫全库
- [ ] Step 2: 读 .verify/index.json ⛔ BLOCKING
- [ ] Step 3: flow — 有则复用；无则问用户 ⚠️ → flows/ + index
- [ ] Step 4: spec — 有则最小改；无则写 `.verify/e2e/specs/`；缺信息时 browser 只取样
- [ ] Step 5: 跑 Playwright（自修重跑 ≤2）
  - [ ] 5a PASS → reports/
  - [ ] 5b FAIL≤2 → 只改闭环断言/等待（禁诊断 log）再跑
  - [ ] 5c 仍 FAIL → browser 探测；改业务 → **vf-fix**；或 BLOCKED
- [ ] Step 6: FAIL/blocked 可沉淀 → **vf-mry**
```

Step 3 必问：实际操作？期望成功？需避免？

Step 4：四环断言；network/console 优先；禁大量 case / 默认 screenshot / 诊断 log。

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

禁止：browser 当验证完成 · 跳过 network/console 截图 · 提交 `.verify/` · 修业务代码 · spec 诊断 log · 空转 >2 次不切 browser

- [ ] 主结果来自 Playwright；证据链 OK
- [ ] FAIL 重跑≤2；超限已切 browser/vf-fix；spec 无诊断 log
- [ ] `.verify/` gitignore；未动业务根 package.json
- [ ] 未改业务代码；index 已更新
