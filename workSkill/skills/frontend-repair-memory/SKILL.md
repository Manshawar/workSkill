---
name: frontend-repair-memory
description: "前端问题经验沉淀（不修代码）。已确认的问题/原因/约束写入本地 .verify/knowledge/，避免重复踩坑。Use when: 沉淀经验, 记规则, 记录修复约束, 记下来这个 bug, 查类似问题规则, repair memory, E2E 失败后沉淀。Not for: 自动修 bug, 写测试, 扫全库, 提交 .verify/。"
---

# Frontend Repair Memory

## Iron Law

**只沉淀已确认、可复用规则。不修代码。不猜原因。不写教程。**

Red Flags：未确认就写「可能是…」· 改业务代码 · 一次造大量规则 · 一次性细节当规则

## Storage

`.verify/` 整夹本地私有。业务仓 `.gitignore`：`.verify/`

```text
.verify/
├── index.json              # 先查（与 e2e-verify 共用）
└── knowledge/
    ├── components/         # 组件级
    └── patterns/           # 跨组件复用
```

按需创建；勿提交。

## Workflow

```
Repair Memory Progress:
- [ ] Step 1: 读 .verify/index.json ⛔ BLOCKING
- [ ] Step 2: 命中 → 只读对应文件，复用或补 Related
- [ ] Step 3: 未命中 → 问用户 ⚠️（勿猜）
- [ ] Step 4: 确认后写最小规则 → knowledge/ + 更新 index
- [ ] Step 5: 多组件同问题 → 抽 patterns/，组件只 Related 引用
```

Step 3 必问：正确行为？当前异常？修复后必须保证？

格式（每节一两句；Rule = 以后必须遵守的约束）：

```md
# Name
## Problem
## Cause
## Rule
## Scope
## Related
```

## Anti-Patterns / Pre-Delivery

禁止：扫全库找问题 · 记一次性细节 · 大段代码 · 重复 index · 教程式长文 · 改业务代码

- [ ] 只写规则，未改业务代码
- [ ] index 已更新；无长文/大段代码
- [ ] 可复用；一次性已拒记
