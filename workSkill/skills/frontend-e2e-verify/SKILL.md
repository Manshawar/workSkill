---
name: frontend-e2e-verify
description: "低成本前端业务闭环验证：先据代码写/复用最小 Playwright spec 再跑；agent-browser 仅探不确定信息。发现问题不修复。Use when user says 验证一下这次改动, 业务验证, 写测试再跑, 回归验证, e2e verify, 检查业务闭环, AI 改完验一下。Actions: 查 .verify/index.json, 从 diff/代码生成最小 spec, 跑 Playwright, 不确定时用 agent-browser 取定位/结构/网络, 写 .verify/reports/。Not for: 自动修 bug, agent-browser 全量点流程, 每步截图, 扫全站。"
---

# Frontend E2E Verify

## Iron Law

**主路径 = 写/复用最小 spec → 跑测试。agent-browser 只取信息，不做全量业务验证。发现问题，不修复。**

闭环四环缺一不可：

```text
Trigger → Process → Data → Feedback
```

单独成立不算过：页面打开 / 能点 / 弹窗显示 / 接口 200。

Red Flags（出现则停）：
- 用 agent-browser 从头到尾点完整个 flow
- 改业务代码「顺便修」
- 一次生成大量 case / 每步截图
- 无 flow、无用户确认就猜业务成功标准

## 工具分工

| 工具 | 用途 | 禁止 |
|---|---|---|
| **Playwright spec** | 主验证：跑闭环、持续复用 | 为「能点」堆无关断言 |
| **agent-browser** | 辅：不确定时取 定位/结构/网络/控制台 | 替代整段 E2E、逐步截图 |
| **代码/diff** | 推导步骤、接口、状态点 | 扫全库 |

执行 agent-browser 时遵循其 skill（session sticky、`snapshot -i`）。截图仅视觉/结构无法判断时。

## Storage

```text
.verify/
├── index.json      # flow / spec / knowledge / report
├── flows/          # 业务描述（非脚本）
├── knowledge/
└── reports/

tests/e2e/          # 最小 Playwright spec（项目约定目录可调）
```

## Token 控制

```text
index → 相关 flow/spec → 相关 knowledge →（仅缺口）agent-browser 取样 → 跑 spec → 最小报告
```

禁止：扫全库、加载全部历史、完整 DOM、agent-browser 全量验证、验证无关 flow。

## Workflow

```
E2E Verify Progress:
- [ ] Step 1: 范围 — git diff + 相关源码（路由/表单/API 调用点），勿扫全库
- [ ] Step 2: 读 .verify/index.json ⛔ BLOCKING
- [ ] Step 3: 定 flow
  - [ ] 3a 有 flow → 复用
  - [ ] 3b 无 flow → 问用户 ⚠️ REQUIRED → 写 .verify/flows/ + 更新 index
- [ ] Step 4: 定 spec
  - [ ] 4a 有对应 spec → 复用/按 diff 最小改
  - [ ] 4b 无 spec → 据 flow+代码写最小 spec → tests/e2e/ + 更新 index
  - [ ] 4c 定位/选择器/接口路径不确定 → agent-browser 只取缺口信息（禁止走完全流程）
- [ ] Step 5: 跑 Playwright → 按四环判 PASS/FAIL
- [ ] Step 6: 写 .verify/reports/
- [ ] Step 7: FAIL 可沉淀 → knowledge 或 frontend-repair-memory（本 skill 不修）
```

### Step 3b 必问

1. 用户实际操作流程？
2. 期望成功结果？
3. 需避免的问题？

### Step 4 写 spec 规则

必须：
- 覆盖闭环四环（操作 → 处理/请求 → 数据/列表或详情 → UI 反馈）
- 最小化、可维护；复用项目 fixture / auth / 工具
- 断言对准成功标准，不堆装饰性检查

禁止：
- 一次大量 case、模拟所有分支
- 默认 fullPage 截图
- 把探路用的 agent-browser 步骤抄成超长脆弱脚本

### agent-browser 取样清单（按需，取完即停）

Ask：缺什么信息才能写稳 selector / 等网络？
- 交互元素 ref / 稳定选择器
- 关键提交请求 URL/方法
- 成功后 DOM 关键变化点
- 控制台报错（若有）

取到缺口 → 回 Step 4 写/改 spec。**不要**继续用浏览器「验证通过」。

## Flow 格式（短）

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
spec: tests/e2e/user-create.spec.ts
```

## 报告格式

```text
Flow: <name>
Spec: <path|none>
Result: PASS | FAIL

验证:
Trigger:  通过/失败
Process:  通过/失败
Data:     通过/失败
Feedback: 通过/失败

问题: <一两句>
证据: <测试失败摘要 / 关键请求或状态；非截图堆>
探路: <若用过 agent-browser：取了什么，一两句>
```

四环任一失败 → FAIL。

## Anti-Patterns

- agent-browser 全量点流程当「验证完成」
- 无 spec、只靠对话里「看起来过了」
- 用「能开/能点」代替闭环
- 长篇报告、大段代码进 knowledge
- 自动修业务代码

## Pre-Delivery

- [ ] 主验证来自 Playwright 跑分，非浏览器闲逛
- [ ] agent-browser 若用：仅补信息，有记录在「探路」
- [ ] 闭环四环有断言或等价检查
- [ ] 未改业务代码；无逐步截图
- [ ] index.json 已更新；报告格式正确
