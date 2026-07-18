---
name: frontend-repair-memory
description: "前端问题经验沉淀（不修代码）。将已确认的问题、原因、约束写入项目 .verify/knowledge/，避免重复踩坑。Use when user says 沉淀经验, 记规则, 记录修复约束, 记下来这个 bug, 查类似问题规则, 问题经验库, repair memory, knowledge base。Triggers after E2E 失败后沉淀, 或用户确认修复后要留规则。Actions: 查询已有规则, 询问确认后写最小规则, 抽象到 patterns/, 更新 index.json。Not for: 自动修 bug, 写测试, 扫全库。"
---

# Frontend Repair Memory

## Iron Law

**只沉淀已确认的可复用规则。禁止自动修代码、禁止猜原因、禁止写教程式长文。**

Red Flags（出现则停，回到询问用户）：
- 「我觉得原因可能是…」（未确认就写）
- 开始改业务代码
- 一次创建大量规则文件

## Storage

所有知识在**当前项目**内：

```text
.verify/knowledge/
├── components/     # 组件级规则
├── patterns/       # 跨组件复用规则
└── index.json      # 索引（先查这里）
```

不存在则按需创建，不预装内容。

## Workflow

```
Repair Memory Progress:
- [ ] Step 1: 查索引 ⛔ BLOCKING — 读 .verify/knowledge/index.json
- [ ] Step 2: 命中 → 只读对应文件，复用已有规则（结束或补充 Related）
- [ ] Step 3: 未命中 → 询问用户 ⚠️ REQUIRED（勿猜）
- [ ] Step 4: 用户确认后写最小规则 + 更新 index.json
- [ ] Step 5: 多组件同问题 → 抽到 patterns/，组件文件只 Related 引用
```

### Step 3 必须问清

1. 正确行为是什么？
2. 当前异常是什么？
3. 修复后必须保证什么？

### Knowledge Format

```md
# ComponentOrPatternName

## Problem
## Cause
## Rule
## Scope
## Related
```

每节一两句。Rule 写「以后必须遵守的约束」，不写操作教程。

## Anti-Patterns

- 主动扫描整个项目找问题
- 记录一次性、不可复用的细节
- 复制大段代码进 knowledge
- 重复已有 index 条目
- 把修复方案写成文档/教程

## Pre-Delivery

- [ ] 只写了规则，没改业务代码
- [ ] index.json 已更新
- [ ] 无长文、无大段代码粘贴
- [ ] 可复用；一次性问题已拒绝记录
