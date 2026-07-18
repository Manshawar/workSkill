下面给你两个**第一版最小可用 Skill Prompt**。

设计原则：

* 不做大而全
* 不预装大量知识
* 项目内沉淀
* 渐进式披露
* 不让模型重复理解整个项目
* 不自动乱修复
* 不生成大量测试代码

目录建议：

```text
.claude/
└── skills/

    ├── frontend-repair-memory/
    │   └── SKILL.md
    │
    └── frontend-e2e-verify/
        └── SKILL.md
```

---

# Skill 1：frontend-repair-memory

用途：

**问题经验沉淀，不负责自动修复。**

复制下面作为 SKILL.md：

```md
# Frontend Repair Memory

## Role

你负责维护前端问题经验库。

你的目标不是自动修复代码，而是将已经确认的问题、原因和约束沉淀下来，避免未来重复出现。


## Core Principle

少而精。

只记录可复用规则。

禁止:
- 长篇分析
- 复制大量代码
- 记录一次性问题
- 重复已有知识


## Storage

所有知识必须存放在项目目录:

.verify/knowledge/


结构:

.verify/
 └── knowledge/
     ├── components/
     ├── patterns/
     └── index.json


## Workflow


### 1. 问题出现

首先检查:

.verify/knowledge/index.json


判断是否已有相关记录。


### 2. 已存在知识

读取对应文件。

例如:

components/user-selector.md


只使用已有规则。


### 3. 不存在知识

不要猜测。

向用户询问:

- 正确行为是什么？
- 当前异常是什么？
- 修复后需要保证什么？


根据回答生成最小规则。


### 4. 问题解决后

沉淀:

- 问题
- 原因
- 修复约束
- 适用范围
- 关联组件


## Knowledge Format


示例:

# ComponentName


## Problem

描述出现的问题。


## Cause

确认后的原因。


## Rule

以后必须遵守的约束。


## Scope

适用范围。


## Related

关联知识。


## Reference Rules


优先复用已有规则。

如果多个组件存在相同问题:

抽象到:

patterns/


例如:

form-validation.md


组件文件只引用:

Related:
patterns/form-validation


## Constraints

不要主动扫描整个项目。

不要主动创建大量规则。

不要把修复方案写成教程。

知识应该像规则库，而不是文档库。
```

---

# Skill 2：frontend-e2e-verify

用途：

**AI 写代码后的自动验证入口。**

复制下面作为 SKILL.md：

```md
# Frontend E2E Verify


## Role

你负责验证前端修改后的业务行为。

使用项目已有的 Playwright E2E 能力。

你的目标:

发现问题，而不是修复问题。


## Core Principle

优先复用。

不要重复生成测试。

不要探索整个页面。

不要使用浏览器进行大量自由操作。


## Workflow


### 1. 项目检查

首先检查项目:

- package.json
- playwright配置
- tests/e2e目录
- .verify目录


确认当前项目测试能力。


### 2. 获取修改范围

通过 git diff 获取本次修改文件。


不要扫描整个项目。


### 3. 查询验证索引


读取:

.verify/index.json


寻找:

- 组件验证
- 页面验证
- 业务流程验证


### 4. 已存在验证

直接执行对应测试。


例如:

tests/e2e/user-selector.spec.ts


不要重新生成测试。


### 5. 不存在验证


不要立即编写复杂脚本。


先询问用户:

- 用户如何操作？
- 正确结果是什么？
- 哪些异常需要避免？


根据回答生成最小 E2E case。


保存:

tests/e2e/


并更新:

.verify/index.json


### 6. 执行结果


输出:

- 测试结果
- 失败步骤
- 错误信息
- 复现流程


保存:

.verify/reports/


## Testing Rules


优先验证:

1. 用户关键流程

2. 状态变化

3. 数据提交

4. 页面刷新


例如:

表单:

输入
→ 校验
→ 提交
→ 成功状态


选择组件:

选择
→ 状态更新
→ 校验变化


CRUD:

新增
→ 列表刷新

编辑
→ 数据更新

删除
→ 数据消失


## Test Creation Rules


生成测试时:

必须:

- 最小化
- 可维护
- 复用已有工具


禁止:

- 一次生成大量case
- 模拟所有用户行为
- 创建重复测试


## Progressive Disclosure


读取顺序:

第一层:

.verify/index.json


第二层:

相关knowledge


第三层:

具体测试文件


第四层:

历史report


不要一次加载全部测试和知识。
```

---

# 两个 Skill 的协作关系

最终：

```text
AI修改代码

      |
      v

frontend-e2e-verify

      |
      |
      +----通过
      |
      |
      +----失败

             |
             v

     frontend-repair-memory

             |
             v

       沉淀规则

             |
             v

      下次自动复用
```

---

这两个第一版应该控制在：

```
frontend-repair-memory
≈ 80行

frontend-e2e-verify
≈ 100行
```

不要继续增加。

后续增长的应该是：

```
.verify/knowledge
.verify/cases
.verify/reports
```

而不是 SKILL.md。

这符合你之前做 skill-installer 时确定的原则：**能力定义和项目知识分离。**
