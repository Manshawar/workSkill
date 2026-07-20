---
name: daily-report
description: "Generate a daily work report in 按小时填写的运维/前端/后端/测试/产品日报 style. Developers: gather today's git commits from multi-repo list (remembered across sessions) as reference for derivation, not 1:1 mapping. Non-developers (运维/产品/测试): use --append only, no git. Role (前端/后端/运维/测试/产品) asked once and remembered; switch via --role. Project name from git repo dir name + model-translated to Chinese (user override via --display-name). Optional auto-copy to clipboard (asked once, requires Node.js)."
allowed-tools:
  - Bash(node **/daily-report/scripts/daily-report.js *)
  - Read(**/daily-report/SKILL.md)
  - Read(**/.daily-report/**)
  - Write(**/.daily-report/**)
---

# Daily Report

## Iron Law

**绝不凭空编造具体的项目模块名、PR 编号、客户名、文件路径。**

**commit 是参考素材，可以基于 commit 推导相关工作**（如 fix bug 配套的排查/提测、refactor 配套的文档/联调），但**不得脱离 commit 凭空编造**。

## Progress

```
Daily Report Progress:

- [ ] Step 0: init（有配置则静默）
- [ ] Step 1: 仓库范围（use_git=false 跳过）
- [ ] Step 2: gather ⚠️ REQUIRED
- [ ] Step 2b: 翻译 → set-display-name ⛔ BLOCKING（display_name 空才写）
- [ ] Step 3: 补齐 ≥ target ⛔ BLOCKING
- [ ] Step 4: emit（剪贴板纯分点 + sheetTime 单行）⛔ BLOCKING
- [ ] 交付前自检（见 Step 4.4）
```

## 主动型 vs 被动型（补齐铁律）

| 类型 | 自动补 | 例子 |
|---|---|---|
| ✅ 主动型 | **允许** | code review / 调研 / 文档 / 联调 / 排查 / 提测 |
| ❌ 被动型 | **禁止** | 参与晨会 / 周会 / 整理清单 / 跟进 bug |

被动型必须用户口头/--append 显式提供。补齐到 target 只能从主动型池挑。

## 实现约束

- 一律 `node scripts/daily-report.js`，不跑 bash 子脚本
- 一律 Node 原生 JSON，**不**依赖 `jq`
- 一律 JSON 配置；**记忆与日报归档在 skill 包外** `.daily-report/`（与 vf 族 `.verify/` 同思路，update skill 不丢）
  - 配置：`<skills 父目录>/.daily-report/setting.json`
  - 归档：`.daily-report/history/YYYY-MM-DD.md`（每次 `emit` 自动写，同日覆盖）
  - 例：`mySkills/.daily-report/` 或 `~/.claude/.daily-report/`
  - 旧 `skills/daily-report/memory/` 在首次 `init` 时自动迁移

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
| `--show-totals` | false | 末尾追加汇总行（仅聊天展示；**绝不**进剪贴板） |
| `--day-end HH:MM` | setting / 20:30 | 临时覆盖黑心下班下限（如加班 `21:00`） |
| `--no-clipboard` | — | 临时跳过剪贴板（即便 auto_copy=true） |

**argument-hint**: `[--date YYYY-MM-DD \| --yesterday] [--user-repo <path>]* [--add-repo <path>] [--project <name>] [--role <前端\|后端\|运维\|测试\|产品>] [--append "文本=Xh"]* [--target-hours N] [--max-items N] [--day-end HH:MM] [--show-totals] [--save-role]`

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
  "day_end_min": "20:30",
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
| `auto_copy = true/false` | ✅ | **跳过询问** |
| `auto_copy = null` | ❌ | AskUserQuestion "是否启用剪贴板?" → `init --auto-copy "$BOOL"` |
| `day_end_min` | ✅（默认 20:30） | **跳过询问**；持久改用 `init --day-end 21:00` |

**首次典型流程**（2 次询问 + 2 次 Bash）：
1. `init` → 拿全部数据
2. AskUserQuestion 角色 → `init --role "$ROLE"`
3. AskUserQuestion 剪贴板 → `init --auto-copy "$BOOL"`
4. 仓库存档空 → "扫描当前?添加其他?" → `save-repo --cwd`

**之后每天**（0 次询问，1 次 Bash）：`init` 静默通过。

## Step 1: 选择仓库范围

**use_git=false 角色（运维/产品/测试）跳过本步**，直接进 Step 3（用 --append 补齐）。

**use_git=true 角色**：

1. **cwd 必做探测**（`gather` 内部自动）：是 git → 永久写 setting；已在存档则 touch `last_used_at`
2. **用户显式指定** `--user-repo <path>...` → 永久存档 + 合并。给了用户仓库仍必做 cwd 探测
3. **仅**存档空、cwd 非 git、用户未指定 → AskUserQuestion → `save-repo --cwd` / `--path <p>`

> cwd 与用户仓库**永远合并**，禁止「给了 --user-repo 就跳过 cwd」。

## Step 2: 一次性采集（N 仓库 = 1 次 Bash）

`gather` 内部：读 setting.repositories（无 `--repos` 时）+ 探测 cwd + 合并 `--user-repo` + 去重存档 + collect + 工时。

```bash
# 情况 A: 默认，1 次 Bash（自动读存档 + cwd）
RESULT=$(node scripts/daily-report.js gather --date "$DATE")

# 情况 B: 追加用户仓库，仍探测 cwd
RESULT=$(node scripts/daily-report.js gather \
  --user-repo ~/work/project-b/ \
  --user-repo ~/work/project-c/ \
  --date "$DATE")

# 情况 C: 当天加班到 21:00
RESULT=$(node scripts/daily-report.js gather --date "$DATE" --day-end 21:00)
```

**工时算法（黑心老板版，`computeSessionHours`）**：
- 0 commit → 0；**1 commit → 1.5h**
- 2+ commits：起点 = max(最早 commit, 09:00)；终点 = max(最晚 commit, `day_end_min`)
- `day_end_min` 优先级：`--day-end` > `setting.day_end_min` > **20:30**
- hours 半小时粒度，cap [0.5, 14]

**项目名 → 中文翻译**：gather 输出 `project` 优先级 = `display_name` > `alias`（目录名）> `detectProject` > `【通用】`。模型输出时**必须把英文名译成业务中文**。无明显线索 → `【通用】`。

**翻译后存档 ⛔ 必做**：`display_name` 为空的 repo 必须：
```bash
node scripts/daily-report.js set-display-name \
  --path <repo-path> --name "<翻译后的中文名>"
```
已有非空 `display_name` 跳过。手动覆盖：`save-repo --cwd --display-name "中文项目名"`。

**commit 提炼**（不要 1:1）：
- 少 → 扩展：3 条 commit 推导 5-8 条
- 多 → 归纳：10 条 commit 合并 5-6 主题
- 改写见「commit 改写规则」

**detect-project UNKNOWN** → `path.basename(repoPath)` 兜底，**不**弹 Ask。`--project` 显式覆盖。

## Step 3: 补齐到 target

用 Step 0 的 `categories` 从「主动型条目池」选类目补齐。

**强制约束**：
- 总时长 ≥ target（默认 8h）——**硬性违规**不允许低于
- 单条 0.5h ≤ X ≤ 4h，**必须是整数或 .5**
- 单条日报项目数 ≤ 2（≥3 合并到【通用】）
- 已 `--append` → 直接用，不叠加
- commit 已覆盖全天 → 不强行补
- 完全无产出 → 告知「今日完全无产出，是否记录 0h 或事后补 --append」

---

## 一、commit 改写规则

1. 去掉 `[fix]` / `feat:` / `refactor:` 前缀
2. 中文标点（、，。），动词开头
3. 偏开发 → 业务表述（如 `fix vue ref` → `修复组件响应式数据异常`）

---

## 二、主动型条目池（自动补齐用）

> 仅完整日报补齐到 target 时用。按角色 `categories` 选类目。

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

### ⚠️ 被动型（**绝不**自动补，必须用户口头/--append）
- 参与晨会 / 周会 / 整理清单 / 跟进 bug —— 一眼假

---

## 三、排版规范

### 格式
```
N. 【项目名】{动作}{对象}{、补充说明}。- {X.X}小时
```

### 项目名来源（优先级）
1. `--project` 参数
2. `gather` 输出的 `project` / `display_name`
3. commit message 关键词
4. 【通用】兜底

### 项目归属选择
| 当日 commit 主导项目 | 软性条目归属 |
|---|---|
| 主项目 X 居多 | 软性条目多用 【X】 或 【通用】 |
| 多项目并行 | 按各项目时长缺口加权分配 |
| 通用类条目（调研/文档） | 用 【通用】 |

**避免单条日报 ≥ 3 个项目**。**禁止硬编码**【项目C】——必须用真实仓库名/中文名。

### 汇总行（`--show-totals` 时仅聊天展示）
```
---
合计 8 条 / 8.0 小时
  - 日报生成器：4 条 / 2.5 小时
```

---

## Step 4: 输出 + 剪贴板

**铁律：两份文本；剪贴板只粘分点；sheetTime 单行。**

### 4.1 日报（剪贴板粘这个）

```
1. 【日报生成器】重写 detect-project 为 Node.js、合并脚本。-1.5小时
2. 【日报生成器】工时下限改为 20:30、支持 --day-end。-1小时
```

**⛔ 剪贴板铁律（违反任一条 = 输出失败）**：
1. 不带 `日报:` 前缀 / `---` / 合计行 / 项目小计 / sheetTime / 标题注释
2. **只**分点：`1. ` `2. ` … 严格递增
3. 每条：`N. 【项目名】{动作}{对象}{、补充}。- {Xh}`（Xh 整数或 .5）

### 4.2 sheetTime（单行 ≤80 字）

```
sheetTime: 重写 detect-project；工时下限 20:30；支持 day-end 覆盖
```

**⛔ sheetTime 铁律**：
1. 不带分点编号 / `【项目名】` / 小时数 / 换行 / 缩进列表
2. 单行 ≤80 字，超则前 79 + `…`
3. 模型自己概括，用 `；` 连接；前缀 `sheetTime: ` 由 `emit` 加

### 4.3 执行 emit

```bash
node scripts/daily-report.js emit \
  --daily "$DAILY_REPORT" \
  --sheet-time "$SHEET_TIME" \
  --date "$DATE"
```

- `$DAILY_REPORT` = 纯分点
- `$SHEET_TIME` = 单行概括（无 `sheetTime:` 前缀）
- `$DATE` = 日报日期（与 gather 一致；默认今天）
- `emit` **自动**写入 `.daily-report/history/$DATE.md`（失败不阻断）

### 4.4 交付前自检 ⛔

- [ ] 总时长 ≥ target
- [ ] 剪贴板无合计/`---`/sheetTime
- [ ] sheetTime 单行 ≤80、无【】/小时数
- [ ] 无被动型自动条；无编造模块名

---

## Anti-Patterns

**输出层**：
- ❌ 编造无 commit 支撑的具体 bug/模块 / 硬编码【项目C】
- ❌ 自动生成被动型（晨会/周会/整理清单/跟进 bug）
- ❌ 漏写【项目名】 / 工时非 .5 粒度 / emoji /「同事」指代
- ❌ 收集别人 commit（按 `git_user_email` 过滤）
- ❌ 单条 >4h 或 <0.5h / 单条日报项目数 ≥3
- ❌ 剪贴板带合计/`---`/sheetTime；sheetTime 多行/带【】/超 80 无截断

**流程层**：
- ❌ 跑 shell/`jq`；每次 Read roles.json
- ❌ 总时长 < target 仍输出；Ask 了不写回 config
- ❌ 剪贴板失败阻断主流程
- ❌ **给了 `--user-repo` 就跳过 cwd 探测**
- ❌ 嵌套 `list-repos` 喂 `gather`（gather 无参时已自动读存档）
