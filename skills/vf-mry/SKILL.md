---
name: vf-mry
description: "前端问题经验沉淀（vf 族，memory）。已确认问题/原因/约束写入本地 .verify/knowledge/（族共建）。Use when: vf-mry, 沉淀经验, 记规则, 记录修复约束, 记下来这个 bug, 查类似问题规则, repair memory, E2E 失败后沉淀。Not for: 自动修 bug(→vf-fix), 写测试(→vf-e2e), 扫全库, 提交 .verify/。"
---

# vf-mry

## Iron Law

**只沉淀已确认、可复用规则。不修代码。不猜原因。不写教程。**

Red Flags：未确认就写「可能是…」· 改业务代码 · 一次造大量规则 · 一次性细节当规则 · 经验写进 e2e/

## Storage

`.verify/` 整夹本地私有。业务仓 `.gitignore`：`.verify/`

```text
.verify/
├── knowledge/              # 族共建知识库（本 skill 主写）
│   ├── components/
│   └── patterns/
└── e2e/                    # 仅测试：process 编排 / specs / reports（vf-e2e）
```

组件坑、修复约束、测试策略、框架行为 → 一律 `.verify/knowledge/`。  
勿写入 `e2e/`（那边只放 Playwright 与编排 md）。

按需创建；勿提交。

## Workflow

```
vf-mry Progress:
- [ ] Step 1: 读 .verify/knowledge/；需要流程上下文时再读 e2e/index + process ⛔
- [ ] Step 2: 命中 → 只读对应文件，复用或补 Related
- [ ] Step 3: 未命中 → 问用户 ⚠️（勿猜）
- [ ] Step 4: 确认后写最小规则 → .verify/knowledge/
- [ ] Step 5: 多组件同问题 → 抽 patterns/，组件只 Related
```

Step 3 必问：正确行为？当前异常？修复后必须保证？

```md
# Name
## Problem
## Cause
## Rule
## Scope
## Related
```

每节一两句。Rule = 以后必须遵守的约束。

## Anti-Patterns / Pre-Delivery

禁止：扫全库 · 记一次性细节 · 大段代码 · 教程式长文 · 改业务代码 · 把经验塞进 e2e/

- [ ] 只写规则，未改业务代码
- [ ] 写入 `.verify/knowledge/`；无长文/大段代码
- [ ] 可复用；一次性已拒记
