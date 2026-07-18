---
name: frontend-e2e-verify
description: "低成本前端业务闭环验证（非测试生成器、非自动修复）。AI 改代码后用 agent-browser 验证 操作→处理→数据→反馈 是否完整。Use when user says 验证一下这次改动, 业务验证, 跑一下流程, 回归验证, e2e verify, 检查业务闭环, AI 改完验一下, 验证 flow。Actions: 查 .verify/index.json, 按 flow 用 agent-browser 验证, 无 flow 先问用户, 写最小报告到 .verify/reports/, 沉淀到 .verify/flows|knowledge。Not for: 自动修 bug, 默认写 Playwright, 每步截图, 扫全站。"
---

# Frontend E2E Verify

## Iron Law

**验证业务流程闭环，不是页面元素。发现问题，不修复。默认用 agent-browser，不生成测试代码。**

闭环四环缺一不可 → 不算验证完成：

```text
Trigger（用户操作）→ Process（业务处理）→ Data（数据变化）→ Feedback（用户反馈）
```

以下**单独成立不算通过**：页面打开 / 按钮可点 / 弹窗显示 / 接口 200。

Red Flags（出现则停）：
- 改业务代码「顺便修」
- 默认新建 Playwright / 大量 spec
- 每步截图或 dump 完整 DOM
- 无 flow 却自由探索整站

## Storage（项目内，不进 skill）

```text
.verify/
├── index.json      # 先读：flow / knowledge / report 索引
├── flows/          # 业务流程（非测试脚本）
├── knowledge/      # 问题·原因·约束（可交 frontend-repair-memory）
└── reports/        # 最小验证报告
```

## Token 控制

加载顺序：**index → 相关 flow → 相关 knowledge → 必要证据**。

禁止：扫全库、加载全部历史、输出完整页面/DOM、验证无关 flow。

## agent-browser

优先读：**结构 / 定位 / 网络请求 / 控制台错误 / 状态变化**。

截图仅当：UI 样式异常、视觉问题、结构信息无法判断。**禁止每步截图。**

执行时遵循 **agent-browser** skill（session sticky flags、`snapshot -i`，勿关浏览器除非用户要求）。

### 何时才写自动化测试代码

仅同时接近这些条件才考虑：项目已有测试体系 **且** 该 flow 高频重复 **或** 用户明确要求。默认：不写。

## Workflow

```
E2E Verify Progress:
- [ ] Step 1: 范围 — git diff（勿扫全库）
- [ ] Step 2: 读 .verify/index.json ⛔ BLOCKING — 定位相关 flow / knowledge / 历史报告
- [ ] Step 3a: 有 flow → 按 flow 用 agent-browser 验证闭环四环
- [ ] Step 3b: 无 flow → 询问用户 ⚠️ REQUIRED → 写最小 flow 到 .verify/flows/ + 更新 index
- [ ] Step 4: 输出最小报告 → .verify/reports/
- [ ] Step 5: FAIL 且可沉淀 → 写 knowledge 或提示 frontend-repair-memory（本 skill 不修代码）
```

### Step 3b 必问

1. 用户实际操作流程？
2. 期望成功结果？
3. 需要避免的问题？

## Flow 格式（短；不是脚本）

只含：目标、核心操作、成功标准、关联。

```md
# 用户新增

目标: 创建一个用户

步骤:
1. 打开新增页面
2. 填写信息
3. 提交

成功标准:
- 创建接口成功
- 数据保存成功
- 页面显示新数据

关联: user-form
```

## 报告格式（必须遵守）

```text
Flow: <name>
Result: PASS | FAIL

验证:
Trigger:  通过/失败
Process:  通过/失败
Data:     通过/失败
Feedback: 通过/失败

问题: <实际异常，一两句>
证据: <必要信息 only — 请求/状态/错误；非截图堆>
```

四环任一失败 → Result = FAIL。

## Anti-Patterns

- 用「页面能开 / 能点」代替业务闭环
- 默认创建 Playwright spec 或大量 case
- 验证无关流程、重复验证
- 长篇报告、粘贴大量代码进 knowledge
- 自动修复代码

## Pre-Delivery

- [ ] 验证了闭环四环，非仅 UI 可达
- [ ] 用了 agent-browser（或用户明确要求的既有测试）
- [ ] 未默认生成测试文件；未改业务代码
- [ ] 报告符合格式；证据最小化
- [ ] 新 flow / knowledge 已更新 index.json
