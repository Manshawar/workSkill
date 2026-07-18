---
name: frontend-e2e-verify
description: "前端改动后的 E2E 验证入口。用项目已有 Playwright 验证业务行为，发现问题不修复。Use when user says 验证一下这次改动, 跑 E2E, 回归验证, 检查行为, e2e verify, 跑一下相关测试, AI 改完验一下。Actions: git diff 定范围, 查 .verify/index.json, 复用已有 spec 执行, 无 case 时询问后写最小 case, 写 .verify/reports/。Not for: 修 bug, 扫全站乱点, 一次生成大量测试。"
---

# Frontend E2E Verify

## Iron Law

**发现问题，不修复。优先复用已有测试；无 case 先问用户，禁止自由探索整站。**

Red Flags（出现则停）：
- 开始改业务代码「顺便修一下」
- 无索引命中却直接写一堆 case
- 用浏览器大量自由点击探索

## Progressive Disclosure

按层加载，禁止一次读全：

1. `.verify/index.json`
2. 相关 knowledge（若有）
3. 命中的测试文件
4. 历史 report（仅排查需要时）

## Workflow

```
E2E Verify Progress:
- [ ] Step 1: 项目能力 ⛔ BLOCKING — package.json / playwright 配置 / tests/e2e / .verify
- [ ] Step 2: 修改范围 — git diff（勿扫全库）
- [ ] Step 3: 读 .verify/index.json — 找组件/页面/流程验证
- [ ] Step 4a: 已有验证 → 直接执行对应 spec
- [ ] Step 4b: 无验证 → 询问用户 ⚠️ REQUIRED → 最小 case → 更新 index
- [ ] Step 5: 输出结果 + 写入 .verify/reports/
- [ ] Step 6: 失败且需沉淀 → 提示用户走 frontend-repair-memory（本 skill 不修）
```

### Step 4b 必须问清

1. 用户如何操作？
2. 正确结果是什么？
3. 哪些异常必须避免？

保存到 `tests/e2e/`，并更新 `.verify/index.json`。

### Step 5 输出

- 测试结果
- 失败步骤
- 错误信息
- 复现流程

## Testing Priority

优先验证：关键流程 → 状态变化 → 数据提交 → 页面刷新。

参考路径（按需，勿全写）：
- 表单：输入 → 校验 → 提交 → 成功态
- 选择器：选择 → 状态更新 → 校验变化
- CRUD：增/改/删后列表与数据一致

## Test Creation Rules

必须：最小化、可维护、复用项目已有工具/fixture。

禁止：一次大量 case、模拟所有行为、重复已有 spec。

## Anti-Patterns

- 无 Playwright 时硬编复杂脚本而不告知用户
- 探索整个页面找「可能相关」的测试
- 失败后自动修代码
- 一次加载全部 tests + knowledge + reports

## Pre-Delivery

- [ ] 只跑/写了与 diff 相关的最小验证
- [ ] 未改业务代码
- [ ] 新建 case 已更新 index.json
- [ ] 报告在 .verify/reports/（若有失败）
- [ ] 无「顺便修复」
