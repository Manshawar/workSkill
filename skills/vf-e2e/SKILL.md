---
name: vf-e2e
description: "低成本前端业务闭环 E2E（vf 族）。Agent 读代码写编排 md + Playwright spec，在 .verify/e2e 真浏览器执行；FAIL 必须先判责再分流，禁空转改 spec。经验进 .verify/knowledge/。Use when: vf-e2e, E2E, 验证业务流程, 走一遍正常流程, 业务验证, 写 Playwright 再跑, 回归验证, 生成 e2e spec。Not for: 修 bug(→vf-fix), evaluate 兜底走通, 只扫 git diff, 根目录装 playwright, 提交 .verify/, 另起 Agent Runtime。"
---

# vf-e2e

## Iron Law

**验不修。FAIL 未判责 → 禁止改 spec。自修≤2 且只动等待/选择器/断言。业务问题 → vf-fix，修完再回本 skill 续跑。**

闭环四环缺一不可：`Trigger → Process → Data → Feedback`  
单独不算过：页面打开 / 能点 / 弹窗 / 接口 200。

Skill 只定规范；Agent 写编排/spec/判责；Playwright 执行。不另起 Agent Runtime。  
落盘只写**无法从代码快速推导**的信息。

Red Flags：未判责就改 spec · evaluate 模拟用户 · 只靠 URL 判成功 · 只扫 diff 拼断言 · 顺便改业务代码 · 空转 >2 次 · Markdown 复述代码

## 分工

```text
.verify/e2e/         Playwright + 编排 process + specs + reports
.verify/knowledge/   族共建知识库（组件坑/约束；vf-mry 主写）
```

兄弟：`vf-e2e` 验不修 · `vf-fix` 探+修 · `vf-mry` 沉淀  
交叉引用：`e2e/process/*.md` 可供 vf-code / vf-fix 只读；经验不写进 e2e/。

## Roles（视角，非独立 Agent）

同会话切换。禁止为 Role 额外开模型调用。

### Product Planner

Ask：用户目标？主路径几步？成功必须看见什么？哪些规则会导致失败？  
禁止：发明需求 · 记组件树/CSS/selector · 复述代码  
输出 → `.verify/e2e/process/<name>.md`

### QA Reviewer

Ask 四环是否被真实 UI 断言覆盖（Trigger / Process / Data / Feedback）。  
**任何 NEED_FIX / 跑测 FAIL → 必须先出判责，禁止直接回改 spec。**

```md
Review:
Status: PASS | NEED_FIX
Verdict: SPEC | BIZ | ENV | -     # PASS 时 -
Missing: <缺什么或 ->
Risk: <最大风险或 ->
```

## 判责 ⛔（每次 FAIL / NEED_FIX 必做）

Ask（只选一个主因）：

| Verdict | 信号 | 动作 |
|---|---|---|
| **SPEC** | 步骤/选择器/等待/断言写错；真人手测其实能过 | 改 spec 再跑；**累计 ≤2** |
| **BIZ** | UI/接口/状态与代码业务预期不符；手测也挂 | **停手 → vf-fix**；禁止再改 spec「绕过」 |
| **ENV** | 登录墙 / 缺数据 / 服务挂 / 权限 | 问用户；可 → vf-mry |

判不清 → 当 **BIZ** 交 vf-fix（宁肯错交，禁止猜着改 spec）。  
vf-fix 完成后：带着原 process **从跑测续跑**（勿重写编排除非业务变了）。

## Storage

`.verify/` 本地私有；业务仓 `.gitignore`：`.verify/`

```text
.verify/
├── knowledge/
└── e2e/
    ├── index.md
    ├── process/
    ├── specs/
    ├── reports/
    ├── package.json
    └── playwright.config.ts
```

```bash
mkdir -p .verify/{knowledge,e2e/{process,specs,reports}}
cd .verify/e2e && npm init -y && npm i -D @playwright/test && npx playwright install chromium
cd .verify/e2e && npx playwright test specs/<name>.spec.ts
```

例外：已有官方 E2E → 复用其命令，只登记 `e2e/index.md`。禁污染业务根依赖。

### Token 门控

> 未来 Agent 是否无法通过代码快速获得？

否 → 不写。经验 → `knowledge/`；编排 → `e2e/process/`。  
禁：长教程 · 代码解释 · 完整报告 · 大量截图 · selector 教程

### 模板

`e2e/index.md`：

```md
# E2E Index

user-create
process/user-create.md
specs/user-create.spec.ts
```

`e2e/process/<name>.md`：

```md
# user-create

Goal:
创建用户

Flow:
用户列表 → 新增 → 填表 → 提交

Verify:
- 创建成功反馈
- 列表出现新数据

Rules:
- 姓名必填
- 手机号格式正确
```

`reports/`（可选 ≤5 行）：

```text
Flow: user-create | Result: PASS|FAIL|BLOCKED
四环: T✓ P✓ D✓ F✗
Verdict: SPEC|BIZ|ENV
问题: <一句>
证据: <network/console/失败摘要>
下一步: 改spec|vf-fix|问用户|-
```

## Workflow

```
vf-e2e Progress:
- [ ] Step 1: 读 e2e/index.md + 相关 knowledge/ ⛔
- [ ] Step 2: 读 process（有则）+ 业务代码（路由/页/表单/API/成功态；勿扫全库）
- [ ] Step 3: Product Planner — 对齐/新建 process ⚠️ 无则先问：怎么操作？成功什么样？避免什么？
- [ ] Step 4: 写/改最小 spec（缺 selector → browser 只取样）
- [ ] Step 5: Playwright 跑
- [ ] Step 6: QA Reviewer + 判责 ⛔ — 无 Verdict 禁止进入 Step 7
- [ ] Step 7: 按 Verdict 分流
  - [ ] PASS → 更新 index；可选短 report
  - [ ] SPEC → 改等待/选择器/断言，回 Step 5；累计自修 ≤2，超限 → BLOCKED 问用户
  - [ ] BIZ → vf-fix（本 skill 停改）；修完回 Step 5 续跑
  - [ ] ENV → 问用户；可选 vf-mry
```

可选：用户点名「这次改动」时，`git diff` 只辅助选 flow，仍验完整路径。

## Spec 硬约束

- 真人操作：`click` / `fill` / 真实控件。禁 `page.evaluate` 调组件/`confirmFn`/`router.*`/改状态走通
- 成功态：DOM / network 优先；禁只靠 URL 字符串
- 断言覆盖四环；一流一主路径；禁堆 case / screenshot / 诊断 log
- 诊断禁进 spec → agent-browser / vf-fix

## Anti-Patterns / Pre-Delivery

禁止：未判责改 spec · evaluate 模拟行为 · URL 当成功依据 · 用改 spec 绕业务 bug · 为 Role 另开 Agent · 修业务代码 · 空转 >2

- [ ] process 仅 Goal/Flow/Verify/Rules
- [ ] 每次 FAIL 有 Verdict；BIZ 已交 vf-fix；SPEC 自修≤2
- [ ] 真实 UI + 四环；无 evaluate 行为兜底
- [ ] `.verify/` gitignore；未改业务代码；index 已更新
- [ ] 落盘过 Token 门控
