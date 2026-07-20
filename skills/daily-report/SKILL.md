---
name: daily-report
description: "Generate a daily work report in 按小时填写的运维/前端/后端/测试/产品日报 style. Developers: gather today's git commits from multi-repo list (remembered across sessions) as reference for derivation, not 1:1 mapping. Non-developers (运维/产品/测试): use --append only, no git. Role (前端/后端/运维/测试/产品) asked once and remembered; switch via --role. Project name from git repo dir name + model-translated to Chinese (user override via --display-name). Optional auto-copy to clipboard (asked once, requires Node.js)."
allowed-tools:
  - Bash(node **/daily-report/scripts/daily-report.js *)
  - Read(**/daily-report/SKILL.md)
  - Read(**/daily-report/memory/**)
  - Write(**/daily-report/memory/**)
---

# Daily Report

## Iron Law

**绝不凭空编造具体的项目模块名、PR 编号、客户名、文件路径。**

**commit 是参考素材，可以基于 commit 推导相关工作**（如 fix bug 配套的排查/提测、refactor 配套的文档/联调），但**不得脱离 commit 凭空编造**。

## 主动型 vs 被动型（补齐铁律）

| 类型 | 自动补 | 例子 |
|---|---|---|
| ✅ 主动型 | **允许** | code review / 调研 / 文档 / 联调 / 排查 / 提测 |
| ❌ 被动型 | **禁止** | 参与晨会 / 周会 / 整理清单 / 跟进 bug |

被动型必须用户口头/--append 显式提供。补齐到 target 只能从主动型池挑。

## 实现约束

- 一律 `node scripts/daily-report.js`，不跑 bash 子脚本
- 一律 Node 原生 JSON，**不**依赖 `jq`
- 一律 JSON 配置（setting.json），不用 MD

## Parameters

| 参数 | 默认 | 说明 |
|---|---|---|
| (无) | today | 默认生成今天日报 |
| `--date YYYY-MM-DD` | today | 指定日期 |
| `--yesterday` | — | 昨天日报 |
| `--user-repo <path>` | — | 追加用户指定仓库 (可多次, 永久存档, 与 cwd 合并) |
| `--add-repo <path>` | — | 追加仓库到 setting.json.repositories |
| `--project <name>` | 自动推断 | 强制覆盖项目归属 |
| `--append "文本=Xh"` | — | 追加条目 |
| `--role <前端\|后端\|运维\|测试\|产品>` | memory | 临时切换角色 |
| `--save-role` | false | 持久化角色到 memory |
| `--target-hours N` | 8 | 目标总时长（不够时用软工条目补齐） |
| `--max-items N` | 6 | 最多条目数（超出则合并） |
| `--show-totals` | false | 末尾追加汇总行 |
| `--no-clipboard` | — | 临时跳过剪贴板（即便 auto_copy=true） |

**argument-hint**: `[--date YYYY-MM-DD \| --yesterday] [--repo <path>] [--add-repo <path>] [--project <name>] [--role <前端\|后端\|运维\|测试\|产品>] [--append "文本=Xh"]* [--target-hours N] [--max-items N] [--show-totals] [--save-role]`

## Step 0: 静默初始化（**有历史配置时不弹任何询问**）

`node scripts/daily-report.js init` → 输出 JSON，1 次 Bash 搞定：

```json
{
  "memory_dir": "...",
  "setting_path": "...",
  "role": "前端",
  "auto_copy": true,
  "node_available": true,
  "git_user_email": "...",
  "repositories": [...],
  "categories": ["联调", "提测", "UI 走查", "code review", "配合后端"],
  "use_git": true
}
```

**核心规则**：有值的字段直接跳过询问。

| 字段 | 已有值 | 动作 |
|---|---|---|
| `role = "前端"` 等 | ✅ | **跳过询问**,直接用 |
| `role = ""` | ❌ | AskUserQuestion 选角色 → `node scripts/daily-report.js init --role "$ROLE"` |
| `auto_copy = true` | ✅ | **跳过询问** |
| `auto_copy = false` | ✅ | **跳过询问**(用户主动关过) |
| `auto_copy = null` | ❌ | AskUserQuestion "是否启用剪贴板?" → `node scripts/daily-report.js init --auto-copy "$BOOL"` |

**首次典型流程**（2 次询问 + 2 次 Bash）：
1. `node scripts/daily-report.js init` → 1 Bash，拿全部数据
2. AskUserQuestion 角色 → `node scripts/daily-report.js init --role "$ROLE"` → 1 Bash
3. AskUserQuestion 剪贴板 → `node scripts/daily-report.js init --auto-copy "$BOOL"` → 1 Bash
4. 仓库存档空 → "扫描当前?添加其他?" → `node scripts/daily-report.js save-repo --cwd`

**之后每天**（0 次询问，1 次 Bash）：所有字段都有值，`init` 静默通过。

## Step 1: 选择仓库范围

**use_git=false 角色（运维/产品/测试）跳过本步**，直接进 Step 3（用 --append 补齐）。

**use_git=true 角色**：

1. `node scripts/daily-report.js list-repos --json` 读 setting.json.repositories 全部存档 (按 `last_used_at` DESC)
2. **cwd 必做探测**: 用 cwd 检查是否 git repo → 是 → 永久写 setting.json (不在存档就 add, 在就 touch `last_used_at`). 这一步在 Step 2 `gather` 内部自动完成
3. **用户显式指定** (`--user-repo <path>...` 多次) → 永久存档 + 合并进最终列表. 即使给了用户仓库, cwd 探测仍必做, 切到新窗口新 cwd 时自动可用
4. 仅存档为空、cwd 不是 git、用户未指定 → 弹 AskUserQuestion: "扫描当前?添加其他?" → `save-repo --cwd` / `--path <p>`

> cwd 探测和用户仓库**永远合并**, 不允许"用户给了仓库就跳过 cwd 探测". 切到新窗口新 cwd 时, 下次自动用, 不会丢.

## Step 2: 一次性采集（N 仓库 = 1 次 Bash）

**铁律**: cwd 永远在仓库列表里, 用户 `--repo` 只是额外追加, 不能替代 cwd 探测.

**所有合并逻辑都在 `gather` 内部**: 探测 cwd + 合并 `--repos` + 合并 `--user-repo` + 去重 + 统一存档. SKILL.md 不需要 list-repos 那一步.

```bash
# 情况 A: 没用 --repo, 1 次 Bash, 自动用 cwd 仓库
RESULT=$(node scripts/daily-report.js gather \
  --repos "$(node scripts/daily-report.js list-repos --json)" \
  --date "$DATE")

# 情况 B: 给了 --user-repo <p1> <p2>, 1 次 Bash, 仍探测 cwd 并合并
RESULT=$(node scripts/daily-report.js gather \
  --repos "$(node scripts/daily-report.js list-repos --json)" \
  --user-repo ~/work/project-b/ \
  --user-repo ~/work/project-c/ \
  --date "$DATE")
```

`gather` 内部对所有传入的 repo 路径 (包括 cwd 探测到的) 统一存档 (Step 1 必做的 cwd 探测 + 用户指定仓库都进 setting.json).

`gather` 内部完成：touch × N + detect × N + collect × N + 工时估算。

**工时算法（黑心老板版）**：
- 起点 = 当天最早 commit，clamp 到 ≥ 09:00
- 终点 = 当天最晚 commit；若 < 19:30 则按 19:30（黑心下限）
- hours = (终点 − 起点) / 3600，cap [0.5, 14]

**项目名 → 中文翻译**：gather 输出 `project` 优先级 = `display_name`（用户/翻译存档） > `alias`（仓库目录名 `basename(repoPath)`，通常英文如 `daily-report`） > `detectProject`（探测 package.json / pom.xml / settings.gradle / pyproject.toml / Cargo.toml / README.md / git remote） > `【通用】`（兜底）。模型输出日报时**必须把英文名翻译为业务可读的中文**（如 `日报生成器`）。判断依据：commit 内容、路径前缀。无明显线索 → 用 `【通用】`。

**翻译后存档 ⛔ 必做**：模型翻译成功后，**必须**调用 `set-display-name` 写到 mapping 表，下次直接用：
```bash
node scripts/daily-report.js set-display-name \
  --path <repo-path> --name "<翻译后的中文名>"
```
对 gather 输出里每个 `display_name` 为空的 repo 都执行一次。已存在 `display_name` 的（不是空字符串）跳过。

**手动覆盖**：`save-repo --cwd --display-name "中文项目名"` 在 add/时直接设置（不依赖模型翻译）。

**commit 提炼**（不要 1:1 映射）：
- 少 → 扩展：3 条 commit 推导 5-8 条条目
- 多 → 归纳：10 条 commit 合并 5-6 个主题
- 改写规则见下方"commit 改写规则"

**detect-project UNKNOWN** → 用 `path.basename(repoPath)` 兜底（仓库目录名），**不**弹 AskUserQuestion。`--project` 显式覆盖。

## Step 3: 补齐到 target

用 Step 0 拿到的 `categories` 从下方"主动型条目池"选类目补齐。

**强制约束**：
- 总时长 ≥ target（默认 8h）——**硬性违规**不允许低于
- 单条 0.5h ≤ X ≤ 4h，**必须是整数或 .5**（禁止 0.3、1.2 这种）
- 单条日报项目数 ≤ 2（≥3 项目合并到【通用】）
- 已 `--append` 提供的内容 → 直接用，不叠加
- commit 已覆盖全天 → 不强行补
- 完全无产出（无 commit 无主动型可补）→ 告知用户"今日完全无产出，是否记录 0h 或事后补 --append"

---

## 一、commit 改写规则

1. 去掉 `[fix]` / `feat:` / `refactor:` 前缀
2. 中文标点（、，。），动词开头
3. 偏开发 → 改写为业务表述（如 `fix vue ref` → `修复组件响应式数据异常`）

> **工时不再靠 commit 类型估算**，改由 Step 2 的真实提交时间差算出（见上）。

---

## 二、主动型条目池（自动补齐用）

> 仅用于**完整日报**模式补齐工时到 target。Brief 模式不引用本池。

> 按角色 `categories` 选类目（前端→联调/提测，后端→接口对齐/性能优化，运维→升级/备份，测试→走查/复现，产品→需求评审/PRD）。

### 0.5 小时（轻量）
- 【XX】review XX PR、提出排版建议。-0.5小时
- 【XX】编写模块README、补全使用示例。-0.5小时
- 【XX】排查测试环境偶发的XX 报错、定位原因。-0.5小时
- 【XX测试】review XX 测试用例、补充边界条件覆盖。-0.5小时

### 1.0–1.5 小时（中等）
- 【XX】对齐XX 接口字段、确认返回结构。-1小时
- 【XX】复现XX bug、提供排查日志。-1小时
- 【XX】调研XX 方案选型、整理对比文档。-1小时
- 【XX】编写XX 模块技术方案设计文档。-1小时
- 【XX】排查XX 线上问题根因、给出修复方案。-1.5小时
- 【XX测试】编写XX 模块的接口测试用例、覆盖正常与异常分支。-1小时
- 【XX测试】执行XX 模块的回归测试、记录结果与遗留问题。-1.5小时

### 2.0–4.0 小时（重度，仅总时长缺口大时用）
- 【XX】集中处理历史遗留的XX 技术债、清理冗余代码。-2小时
- 【XX】排查线上XX 故障、协同运维定位根因。-3小时
- 【XX测试】主导XX 模块的完整测试设计、编写用例与执行。-3小时

### ⚠️ 被动型（**绝不**自动补，必须用户口头/--append 提供）
- 参与晨会 / 周会 / 整理清单 / 跟进 bug —— 一眼假，领导看了觉得"这人今天没干啥"

---

## 三、排版规范

### 格式
```
N. 【项目名】{动作}{对象}{、补充说明}。- {X.X}小时
```

### 项目名来源（优先级）
1. `--project` 参数
2. `gather` 输出的 `project` 字段（detect-project 探测）
3. commit message 关键词
4. 【通用】兜底

### 项目归属选择
| 当日 commit 主导项目 | 软性条目归属 |
|---|---|
| 主项目 X 居多 | 软性条目多用 【X】 或 【通用】 |
| 多项目并行 | 按各项目时长缺口加权分配 |
| 通用类条目（调研/文档） | 用 【通用】 |

**避免单条日报出现 ≥ 3 个项目**，跨多项目时优先合并到【通用】。**禁止硬编码**【项目C】等角色化标签——必须用真实仓库名。

### 汇总行（`--show-totals` 时追加）
```
---
合计 8 条 / 8.0 小时
  - project-c：4 条 / 2.5 小时
  - 项目D：1 条 / 1.0 小时
  - 通用：3 条 / 4.0 小时
```

### 输出示例
> 以下示例仅演示排版，生成时按 commit 实际归属（不硬编码项目名）。
```
1. 【project-c】排查列表空数据异常、修复组装逻辑。-1小时
2. 【project-c】清理模块 ES 冗余代码、优化结构。-0.5小时
3. 【项目D】对接信息查询接口、联调测试。-1小时
4. 【通用】调研 Vue2 升级 Vue3 的破坏性变更、整理迁移清单。-1.5小时
5. 【project-c】review 卡片组件重构 PR、提出修改建议。-0.5小时
---
合计 5 条 / 4.5 小时
  - project-c：3 条 / 2.0 小时
  - 项目D：1 条 / 1.0 小时
  - 通用：1 条 / 1.5 小时
```

## Step 4: 输出 + 剪贴板（**铁律: 两份文本, 剪贴板只粘分点, sheetTime 单行**）

### 4.1 输出 1: 日报（**剪贴板粘这个**）

```
1. 【日报生成器】重写 detect-project 为 Node.js、合并 7 个 shell 脚本。-1.5小时
2. 【日报生成器】Step 0 静默化、减少批准弹窗。-1小时
3. 【日报生成器】工时改用 commit 时间差计算、增加下限 19:30。-1小时
4. 【日报生成器】新增 --display-name flag 支持仓库中文命名。-0.5小时
5. 【日报生成器】模型翻译后自动存档到 mapping 表。-0.5小时
```

**⛔ 剪贴板格式铁律 (8 条, 违反任意一条都算输出失败)**:
1. ⛔ **绝对不带** `日报:` 前缀 (任何变体如 "日报："、"日 报:" 都不行)
2. ⛔ **绝对不带** `---` 分隔线
3. ⛔ **绝对不带** `合计 X 条 / X 小时` 汇总行
4. ⛔ **绝对不带**项目分类小计 (如 `- project-c：4 条 / 2.5 小时`)
5. ⛔ **绝对不带** sheetTime 内容
6. ⛔ **绝对不带**标题 / 注释 / 说明文字
7. ✅ **只**分点 (`1. ` `2. ` `3. ` ... 严格递增, 每行一条, 不允许 0. / 1、)
8. ✅ 每条格式: `N. 【项目名】{动作}{对象}{、补充说明}。- {Xh}` (Xh 是整数或 .5)

**❌ 错误示例 (绝对禁止)**:
```
1. 【项目A】开发提醒多选功能、重构提醒逻辑与展示。-4.5小时
2. 【项目A】实现功能2 校验逻辑与开关判断。-2.5小时
...
---
合计 6 条 / 12.5 小时                              ← ⛔ 禁
  - 项目A：4 条 / 9.5 小时                       ← ⛔ 禁
  - 项目B：1 条 / 1.5 小时                         ← ⛔ 禁
  - 项目C：1 条 / 1.5 小时                       ← ⛔ 禁
<!-- cspell:disable -->
- 项目A 9.5h（16 commits）— 集中在 功能1 字段落地与多场景适配... ← ⛔ 禁 (这是 sheetTime 缩进格式, 不能进剪贴板)
- 项目B 1.5h — 修改配置项                      ← ⛔ 禁
- 项目C 1.5h — 调整列表样式                  ← ⛔ 禁
<!-- cspell:enable -->
```

**✅ 正确示例 (剪贴板内容)**:
```
1. 【项目A】开发提醒多选功能、重构提醒逻辑与展示。-4.5小时
2. 【项目A】实现功能2 校验逻辑与开关判断。-2.5小时
3. 【项目A】优化功能1 配置 UI 布局与选项。-1小时
4. 【项目A】完善半天说明文案、修复页面跳转异常。-1.5小时
5. 【项目B】修改配置项。-1.5小时
6. 【项目C】调整列表样式。-1.5小时
```

### 4.2 输出 2: sheetTime（**单行 ≤80 字, 另一个系统采集**）

```
sheetTime: 开发功能1 多选与重构；功能2 校验；功能1 UI 优化；半天说明文案+跳转修复；项目B 功能5 修复；列表样式调整
```

**⛔ sheetTime 铁律 (6 条)**:
1. ⛔ **绝对不带**分点编号 (`1. ` `2. ` 等)
2. ⛔ **绝对不带** `【项目名】` 前缀 (任何变体都不行)
3. ⛔ **绝对不带**小时数 / `-1.5小时` / `0.5h` 等
4. ⛔ **绝对不带**多行 / 换行 (只允许 1 行)
5. ⛔ **绝对不带** `- 项目名 Xh` 缩进格式 (那是旧 sheetTime 格式, 禁止)
6. ✅ **单行** ≤ 80 字, 超 80 字末尾加 `…` (保留前 79 字 + `…`)
7. ✅ 模型**自己生成概括**, 不从分点字符串拼
8. ✅ 用 `；` (中文分号) 连接多个动作
9. ✅ 前缀 `sheetTime: ` (冒号后 1 空格, 由 `emit` 内部加, 你只生成单行内容)

**❌ 错误示例 (绝对禁止)**:
```
sheetTime: 项目A 9.5h（16 commits）— 集中在 功能1 字段落地与多场景适配：  ← ⛔ 多行
  - 上下班提醒多选功能开发、提醒逻辑与展示重构（4.5h）                            ← ⛔ 缩进
  - 功能2 校验与开关判断（2.5h）                                              ← ⛔
  ...
```

```
sheetTime: 1. 【项目A】开发上下班提醒多选功能。-4.5小时；2. 【项目A】实现功能2 校验。-2.5小时；...  ← ⛔ 禁带分点编号 / 【】/ 小时数
```

**✅ 正确示例 (sheetTime 单行)**:
```
sheetTime: 开发功能1 多选与重构；功能2 校验；功能1 UI 优化；半天说明文案+跳转修复；项目B 功能5 修复；列表样式调整
```

### 4.3 执行命令（**纯 Node, 一次 emit**）

```bash
node scripts/daily-report.js emit \
  --daily "$DAILY_REPORT" \
  --sheet-time "$SHEET_TIME"
```

`emit` 内部完成:
1. `sheetTime: $SHEET_TIME` 打印到 stdout (前缀自动加)
2. `$DAILY_REPORT` 复制到剪贴板 (auto_copy=true 才执行, 失败不阻断)
3. 可选 `--no-clipboard` 临时跳过剪贴板

**关键变量约束**:
- `$DAILY_REPORT` 只含**分点** (不含 `日报:` / `---` / 合计 / sheetTime)
- `$SHEET_TIME` 只含**单行概括** (不含 `sheetTime:` 前缀, 不含分点, 不含【】, 不含小时数)

---

## 工时算法（`computeSessionHours` 在 gather 内嵌）

- 0 commit → 0
- **1 commit → 1.5h**（单 commit 无法测真实时长，1-2h 中位估）
- 2+ commits → max(first, 09:00) 到 max(last, 19:30) 的差，半小时粒度 cap [0.5, 14]

## Anti-Patterns

**输出层**（错就会被人抓）：
- ❌ 编造"修复了XX模块的XX bug"（无对应 commit） / 硬编码【项目C】
- ❌ 自动生成被动型条目（晨会/周会/整理清单/跟进 bug）
- ❌ 探测失败用【通用】不询问 → 实际用 `path.basename(repoPath)` 兜底
- ❌ 漏写【项目名】前缀 / `0.3h` 写成"0小时30分" / 用"同事/同学"等指代词 / 用 emoji
- ❌ 收集别人 commit（默认按 `git_user_email` 过滤）
- ❌ 单条 > 4h 或 < 0.5h / 工时非整数或 .5（如 0.3、1.2）/ 单条日报项目数 ≥ 3
- ❌ **剪贴板带 `日报:` 前缀 / `---` 分隔线 / `合计 X 条` 汇总行 / 项目分类小计 / sheetTime 内容 / 标题注释** (剪贴板**只能**粘分点)
- ❌ **sheetTime 多行 / 带【】/ 带小时数 / 带分点编号 / 带缩进列表 / 超过 80 字没用 `…` 截断**

**流程层**（错就多批准弹窗 / 多 Read）：
- ❌ 跑 shell 脚本或依赖 `jq`（一律 Node 原生）
- ❌ 每次 Read roles.json / 同时 Read 多个 references（规范已在 SKILL.md）
- ❌ 默认扫 cwd 不询问 / cwd 不命中就弹多选（list-repos 读存档；非空直接用）
- ❌ 总时长低于 target 还输出 / detect-project UNKNOWN 时弹 AskUserQuestion
- ❌ AskUserQuestion 选了不写回 config（必须 `init --role/--auto-copy` 写回）
- ❌ 剪贴板失败时阻断主流程
- ❌ **用户给了 `--user-repo` 就跳过 cwd 探测** (cwd 必做, 用户仓库只是额外追加)
