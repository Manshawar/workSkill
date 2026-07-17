# 演示入口：批量新增主题（EMC 知识库）

> 🎬 **本次演示从此文件进入**——只说一句话（如「新增 5 条主题」「造点测试主题」「批量加 10 条」），AI 按本文件自动跑完。
>
> AI 自动完成：
> 1. 检查 session，失效则调 `emc-session-init` skill 重新初始化
> 2. 跑 `scripts/batch-create-topics.js` 批量新增（带去重，跳过已存在的）
> 3. 跑完后按需生成手工测试用例（调 `hand-test-cases` skill）
>
> 用户不需要分步操作，也不需要知道 session、脚本路径。**同一句话可以反复说、反复跑**——每次都从「检查 session」开始，去重保证不重复。

## 触发场景（任意一条即触发，可反复触发）

- 「新增 X 条主题」
- 「造 N 条测试主题」
- 「批量加几个主题」
- 「跑一下主题批量新增」
- 「去知识库管理里加几条」
- 「帮我准备点测试数据」
- 「新增主题」
- 「再来一次」「再跑一遍」← 故意再说一遍也能跑，去重保证不重复

## 前置条件

- 已通过 `emc-session-init` skill 跑过一次完整流程，`/tmp/emc-session.json` 存在
- session 跨域有效（user / work / eapps 三域都有 cookie）
- `emc-session-init` 本地已配好：`config.local.json`（`account` / `verifyToken` / `accessKey`）+ `ui.local.json`（页面 label）

## 工作流（AI 自己跑完）

### 1. 解析用户意图

从用户消息里提取：

| 参数 | 含义 | 默认值 |
| --- | --- | --- |
| `count` | 新增条数 | 用户没指定时，用 `batch-create-topics.js` 里的 `COUNT`（默认 10） |
| `category` | 主题分类（性能 / UI / 功能 / 边界 / 自定义） | 不指定就用 `VOCAB` 词库全量 |
| `name_prefix` | 主题名称前缀 | 不指定就用词库随机组合 |

> 「新增 5 条性能测试主题」→ count=5 + category=性能；「随便造点数据」→ 用 `COUNT` 全量。

### 2. 检查 session

```bash
ls -la /tmp/emc-session.json 2>/dev/null
```

- 存在 → 跳过初始化，直接到步骤 4
- 不存在 → 跑步骤 3

### 3. 初始化 session（按需，调 `emc-session-init` skill）

session 不存在或已失效时，**不要在本文件里内联 secrets**，直接调 `emc-session-init` skill（从 `config.local.json` + `ui.local.json` 读，不写进仓库）。

**禁止** `cp init.js /tmp/`——旧 `run.js` wrap / 错 `__dirname` 会导致读不到 config/ui。用原路径（`run.js` 已 spawn + `NODE_PATH`）：

```bash
cd .claude/skills/playwright-skill && \
  node run.js ../emc-session-init/scripts/init.js
```

等价直跑：

```bash
cd .claude/skills/emc-session-init && \
  NODE_PATH=../playwright-skill/node_modules node scripts/init.js
```

跑完会在 `/tmp/emc-session.json` 落盘跨域 session（user / work / eapps 三域）。按 skill Step 3 验证；失败就 `rm /tmp/emc-session.json` 重跑。

> 细节（字段名、UI 键、故障表、`waitForURL` 假通过）一律读 skill：`.claude/skills/emc-session-init/SKILL.md`。本文件不重复 secrets / UI 明文。

### 4. 跑批量新增

原路径交给 `run.js`（已 spawn，无需 cp）：

```bash
cd .claude/skills/playwright-skill && \
  node run.js ../../../prompt/scripts/batch-create-topics.js
```

脚本自动：加载 session → 选版块管理员 → 进知识库管理 → 抓现有主题名去重 → 跳过已存在的，只新增缺的。字段、选择器、适用范围策略见下方「新增主题对话框字段」「适用范围策略」。

### 5. 报告（每次跑完都产出，当次结果非历史统计）

每次跑完报告三件事：

| 项 | 模板 |
| --- | --- |
| 跑了哪些步骤 | 步骤 1-5 中哪些执行 / 跳过 |
| 当次新增条数 | 「成功 X / Y，跳过 Z（已存在）」 |
| 验证入口 | 打开 `https://eapps-betacloud.e.lanxin.cn/knowledge-library-dev/...#/knowledge/topic-list` 查看 |

## 一行总入口（手动跑时）

```bash
# session 不存在就先 init，再跑批量新增（均原路径，禁止 cp 到 /tmp）
test -f /tmp/emc-session.json || (cd .claude/skills/playwright-skill && node run.js ../emc-session-init/scripts/init.js) && \
cd .claude/skills/playwright-skill && node run.js ../../../prompt/scripts/batch-create-topics.js
```

## 新增主题对话框字段

脚本已通过 DOM 探针确认字段定位，写新流程时按此引用：

| 字段 | 选择器 | 说明 |
| --- | --- | --- |
| 主题名称 | `input[placeholder="请输入主题名称"]` | 限 20 字 |
| 适用范围 | `input[placeholder="点击选择适用范围"]` | 必填，漏选会报「请选择适用范围」 |
| 排序 | `input[type="number"][placeholder="数字越大排序越靠后"]` | 可选 |
| 主题描述 | `textarea[placeholder="请输入主题描述"]` | — |
| 取消 / 确定 | `.el-dialog` 内对应按钮 | — |

> ⚠️ 文本是「**版块**管理员」不是「板块」，写错会找不到身份选项。

## 适用范围选择策略（重要）

「适用范围」是**必填项**但选择逻辑复杂，三种策略：

| 策略 | 复杂度 | 说明 |
| --- | --- | --- |
| **勾选组织分支**（推荐） | 低 | 勾「测试」「研发」两个 checkbox = 该分支下所有人员。简单但范围大 |
| 搜索 + 选具体人员 | 中 | 用人员搜索框查具体人，逐一加入「已选人员」 |
| 调用 API 跳过 UI | 高 | 找后端接口直接 POST，跳过选择器 |

**默认**：勾组织分支。脚本里用 `getByRole('treeitem', { name: '测试' })` 精确选，避开 `hasText` 嵌套冲突。**如果「测试」「研发」是空分支**，换搜索具体人员。

## 测试数据（词汇库 + 随机组合）

脚本**不写死 TOPICS 数组**，而是从三组词库**运行时随机抽词组合**——每次主题名都不一样，**天然避开去重**：

- `category`：`['性能','UI','功能','边界','回归','压力','安全','兼容','数据','接口']`
- `type`：`['测试','验证','压测','评估','演练','冒烟','巡检']`
- `suffix`：`['主题','用例','场景','用例集','测试集']`
- 命名格式：`{类别}{类型}-{后缀}-{4位随机串}{序号}`，如 `性能压测-主题-k7f201`

**怎么改**：

| 需求 | 改哪里 |
| --- | --- |
| 多跑 / 少跑几条 | `batch-create-topics.js` 里的 `COUNT` |
| 加新词 | 往 `VOCAB` 对应数组 push |
| 完全固定数据 | 把 `TOPICS` 换成字面量数组 |
| 从 JSON 文件读 | `JSON.parse(fs.readFileSync('./topics.json','utf8'))` |
| 命令行参数 | `parseInt(process.argv[2] || '10', 10)` |

> **为什么用「词库 + 随机」而不是固定数组**：测试环境多次跑批量新增，每次名字得不一样才会真正创建新主题（否则全被去重跳过）。

## 跑完之后：生成测试用例（可选下一步）

流程跑通后，如需补**手工测试用例**（UI 渲染点 + 交互点 + 输入边界值，每条带注释，不做接口 / 性能测试），调 `hand-test-cases` skill：它会从本轮步骤序列 / 选择器 / 截图 / 脚本路径收集产物，按 `TC-UI / TC-IX / TC-BV / TC-E2E` 四组生成用例，输出默认写到 `prompt/test-cases-<流程名>.md`。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| session 过期（URL 进 `/passport/`） | `rm /tmp/emc-session.json` 重跑 `emc-session-init` skill |
| init 报 3b ok 但仍在 passport / step 4 超时 | `waitForURL` 假通过或 SSO 未过——见 `emc-session-init/references/troubleshooting.md`；用户本地核 accessKey/verifyToken |
| 「请选择适用范围」错误 | 不应出现——脚本里已勾选"测试""研发" |
| 跳过 0 成功 0 | TOPICS 全已存在；改 `VOCAB` 词库或清空测试数据 |
| dialog 不关 / 超时 | 看 `/tmp/batch-fail-*.png` 截图 |
| 「前往后台」找不到 | 等应用详情页加载完再点 |
| 新标签页 URL 是 about:blank | popup 监听漏了；见 `batch-create-topics.js` 步骤 2 的 `waitForEvent('page')` |
| 「新增主题」按钮没反应 | 用 `button.el-button--primary` 精确选；可能 svg 干扰 |
| textarea 等不到 | 对话框没打开 → 看 `/tmp/batch-fail-*.png` 截图 |
| 找不到「版块管理员」 | 文本是「版块」不是「板块」；或账号未绑定 |
| 提交后 dialog 不关 | API 报错；看 Network 响应或截图 |
| init 缺 config / ui | 见 `emc-session-init` SKILL 首次配置；别把 secrets 贴进对话 |

## 设计原则（给 AI 看的）

1. **永远不直接写 secrets 进脚本 / 提示词**——一律走 `emc-session-init`（`config.local.json` + `ui.local.json` 或 env）。
2. **session 必须存在才能跑批量新增**——不存在就先调 `emc-session-init`。
3. **去重要先看实际列表**——脚本已实现，不要绕过。
4. **测试环境限定**——本仓库所有脚本只在 `*betacloud.e.lanxin.cn` 域名下跑。
5. **失败要可重试**——任何一步失败后用户可以再说一次「再来一次」即重跑（去重保证不重复）。
6. **不把 SSO 页面 label / accessKey 写进本文件或对话**——交给 skill 本地文件。

## 仓库结构

```
prompt/
├── auto-new-topic.md           ← 本文件（场景入口 + 字段 + 策略 + 故障排查）
├── scripts/
│   └── batch-create-topics.js  ← 词库随机 + 去重 + 精确选
└── test-cases-batch-create.md  ← hand-test-cases skill 跑出的产物

.claude/skills/emc-session-init/   ← SSO session 初始化（替代旧 emc-auto-login）
├── scripts/init.js
├── config.local.json              ← gitignore：account / verifyToken / accessKey
└── ui.local.json                  ← gitignore：页面 label
```

> Session 用 `emc-session-init`，出用例用 `hand-test-cases`，批量新增是本文件 + 脚本。三条工作流可**反复跑**：session-init（失效就重跑）→ batch-create（去重保证不重复）→ generate-test-cases（按当次选择器生成）。
