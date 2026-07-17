# Task: Initialize .loopfix AI Development Loop System

你需要帮助我在当前项目中创建一个项目级 AI 工程闭环系统目录。

系统名称：

.loopfix


目标：

建立：

> AI 编码 → 真实验证 → 问题修复 → 经验沉淀 → 后续复用

的闭环。


注意：

当前阶段是 MVP。

不要创建复杂架构。

不要一次生成全部 Skill。

先创建基础目录和核心 validation-loop Skill。


---

# 根目录要求


所有 AI 相关资产必须位于：

```
.loopfix/
```


不要污染业务代码目录。


---

# 创建目录


生成：

```
.loopfix/

├── skills/
│
│   └── validation-loop/
│       └── SKILL.md
│
│
├── references/
│
│   └── agent-browser.md
│
│
├── browser/
│
│   └── probes/
│
│
├── knowledge/
│
│   └── drafts/
│
│
├── runs/
│
│
└── config.yaml

```


---

# 目录职责


## skills/

保存 AI Skill。


当前只有：

```
validation-loop
```


未来扩展：

```
browser-probe

knowledge-memory

repair-agent

```


---

## references/


保存外部工具规范。


例如：

```
agent-browser.md
```


作用：

保存：

- API说明
- CLI命令
- 输出格式
- 使用规范


Skill不要硬编码工具细节。


---

## browser/


保存浏览器验证资产。


当前：

```
probes/
```


Probe定义：

可重复执行的真实业务流程。


例如：

```
user-create.yaml

login.yaml

order-submit.yaml
```


Probe只描述：

浏览器行为。


不要包含：

业务分析。

修复方案。

---

## knowledge/


保存项目经验。


当前：

```
drafts/
```


用于保存：

AI从验证过程中提炼出的经验摘要。


未来演进：

```
rules/

patterns/

incidents/

index.json
```


---

## runs/


保存每次验证运行结果。


例如：

```
runs/

2026-07-17-user-flow/

    evidence.json

    screenshot/

    report.md

```


---

# validation-loop Skill


生成：

```
.loopfix/skills/validation-loop/SKILL.md
```


职责：

作为整个系统入口。


目标：

当用户要求：

- 验证功能
- 检查修改
- 回归页面


执行：

Validation Loop。


---

# Validation Loop


流程：

```
Code Change

↓

Knowledge Lookup

↓

Validation Scope 判断

↓

寻找已有 Probe

↓

执行 agent-browser

↓

生成 Evidence

↓

分析问题

↓

修复

↓

重新验证

↓

保存成功 Probe

↓

生成 Knowledge Draft

```


---

# Validation Scope


支持两种模式。


## Full Flow Validation


默认模式。


场景：

"验证这个页面"

"检查这个功能"


执行完整业务流程。


例如：

```
进入页面

查询

新增

编辑

删除

分页

筛选

```


不要只验证当前修改点。


原因：

一次修改可能影响其他流程。


---

## Targeted Validation


场景：

用户明确：

"修复新增按钮问题"


只执行相关流程。


减少成本。


---

# agent-browser规则


agent-browser作为唯一浏览器执行层。
agent-browser需要使用有头模式 方便我们进行排查

负责：

- 页面访问
- 操作
- snapshot
- screenshot
- console
- network


validation-loop负责：

- 调度
- 判断
- 分析


不要实现浏览器能力。


---

# Probe规则


验证成功后：

必须考虑沉淀Probe。


Probe:

代表：

已验证成功的用户操作流程。


以后：

优先复用。


禁止：

每次重新探索相同流程。


---

# Evidence规则


Evidence保存事实。


包括：

- URL
- 操作步骤
- console错误
- network错误
- screenshot
- 最终状态


Evidence不等于Knowledge。


---

# Knowledge规则


不要保存：

页面级错误。


禁止：

```
user-page-error.md
order-page-error.md
```


应该抽象：

Rule:

长期规则。


Pattern:

通用问题模式。


Incident:

具体案例。


使用交叉引用。


例如：

```
Flow

↓

Probe

↓

Pattern

↓

Rule

```


---

# 修复原则


优先：

最小修改。


禁止：

- 无关重构
- 顺便优化
- 修改框架


目标：

恢复正确行为。


---

# 输出要求


请生成：

1. .loopfix目录结构

2. validation-loop/SKILL.md

3. config.yaml初始模板

4. agent-browser reference模板


要求：

MVP。

不要提前创建其他Skill。

保持通用。

