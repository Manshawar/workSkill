# skills (`npx skills`) — 接口参考

`npx skills` 是开放 agent skills 生态的 CLI。本文件是 **AI 在 skill-hub 工作流中需要安装/卸载/列举/更新 skill 时查阅的接口参考**,聚焦 **claude-code、非交互、原子化按需** 场景。

> 本文件是上游 [vercel-labs/skills](https://github.com/vercel-labs/skills) README 的 claude-code 精简提取版。被删减的内容(70+ agent 全表、完整发现目录、完整外链等)可经上游 re-sync 还原——本地精简不构成信息丢失。

---

## AI 决策速查

先定意图,再套命令模板。所有命令均为**非交互**形式(加 `-y` + 显式 `--skill` / `--agent` / `-g`),因为 AI 无法回答交互 prompt。

| 意图 | 命令模板 | 备注 |
| --- | --- | --- |
| 探查仓库有哪些 skill | `npx skills add <source> --list` | 不安装,只列出 |
| 装单个 skill 到项目 | `npx skills add <source> --skill <name> -a claude-code -y` | 默认 project scope |
| 装单个 skill 到全局 | `npx skills add <source> --skill <name> -a claude-code -g -y` | `-g` → `~/.claude/skills/` |
| 装整仓库全部 skill | `npx skills add <source> --skill '*' -a claude-code -y` | `'*'` = 全部 |
| 不安装、只用一次 | `npx skills use <source> --skill <name>` | prompt 输出到 stdout |
| 用一次并直接起 agent | `npx skills use <source> --skill <name> --agent claude-code` | 交互式启动 |
| 查看已装 skill | `npx skills list` / `npx skills ls -g` / `npx skills ls -a claude-code` | |
| 搜索可装 skill | `npx skills find <keyword>` 或 `npx skills find <kw> --owner <org>` | |
| 更新已装 skill | `npx skills update <name> -y` 或 `npx skills update -y` | |
| 卸载某 skill | `npx skills remove <name> -y` | |
| 卸载 claude-code 全部 skill | `npx skills remove --skill '*' -a claude-code -y` | |
| 新建 SKILL.md 模板 | `npx skills init [name]` | 创建是 skill-forge 职责,此处仅备查 |

**决策规则:**
- 默认 **project scope**(`./.claude/skills/`,随项目提交、团队共享);需跨项目可用才加 `-g`(`~/.claude/skills/`)。本 skill 的核心场景是 project scope,避免污染全局。
- 默认 **symlink**(单一真源、易更新);目标环境不支持 symlink 才加 `--copy`。
- 装之前先 `--list` 探查实际 skill 名,避免拼错 `--skill <name>`。
- 含空格的 skill 名必须加引号:`--skill "Convex Best Practices"`。

---

## 非交互模式(必读)

`npx skills` 默认交互式(弹 prompt 选 agent/scope/method)。AI 场景**必须**绕开,否则会卡住:

- `-y, --yes`:跳过所有确认。
- 显式 `-a, --agent <agents...>`:指定目标 agent。
- 显式 `-s, --skill <skills...>`:指定 skill。
- 显式 `-g`(global)或留空(project):指定 scope。(`update` 用 `-p`/`-g`。)
- `--all`:安装全部 skill 到全部 agent 的快捷写法。
- `--copy`:指定 method 为 copy。

> **原子化按需安装的最小命令**(本 skill 核心场景):
> ```bash
> npx skills add <source> --skill <name> -a claude-code -y
> ```

---

## 与 Claude Code 插件机制的关系

`npx skills` 和 Claude Code 自带的 `/plugin` 市场是**两套独立机制**,不要混用:

| 维度 | `npx skills` | Claude Code `/plugin` |
| --- | --- | --- |
| 安装产物 | symlink(默认)或 copy 到 `.claude/skills/` / `~/.claude/skills/` | 经 marketplace 注册到 `~/.claude/plugins/` |
| 卸载命令 | `npx skills remove` | `/plugin` 交互命令 |
| 适合 | 单 skill 原子化拉取/卸载 | 整个 plugin/marketplace 的启用与管理 |
| 跨 agent | 支持一次装多个 agent(`-a` 多次) | 仅 Claude Code |

> ⚠️ 若某 skill 原本经 `claude plugin` 安装,**`npx skills remove` 可能卸不掉**,需走 `/plugin`。
> 判断:`npx skills list` 能看到的 = `npx skills` 管的;看不到却仍生效的 = `/plugin` 体系管的。

---

## `skills add` — 安装

### Source Formats(如何拼 `<source>`)

AI 构造命令时最易出错处,务必按以下形式:

```bash
# GitHub shorthand (owner/repo) —— 最常用
npx skills add vercel-labs/agent-skills

# Full GitHub URL
npx skills add https://github.com/vercel-labs/agent-skills

# Direct path to a SPECIFIC skill (原子化安装的关键写法)
npx skills add https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines

# GitLab URL
npx skills add https://gitlab.com/org/repo

# Any git URL
npx skills add git@github.com:vercel-labs/agent-skills.git

# Local path
npx skills add ./my-local-skills
```

> 装单个 skill 的两种等价写法:
> - 指向仓库根 + `--skill <name>`:`npx skills add owner/repo --skill <name>` ← **推荐**(不依赖目录路径,更稳)
> - 直接指向该 skill 的 tree URL:`npx skills add https://github.com/owner/repo/tree/main/skills/<name>`

### Options

| Option | Description |
| --- | --- |
| `-g, --global` | Install to user directory instead of project |
| `-a, --agent <agents...>` | Target specific agents (e.g. `claude-code`);CLI 自动检测已装 agent |
| `-s, --skill <skills...>` | Install specific skills by name (use `'*'` for all) |
| `-l, --list` | List available skills without installing |
| `--copy` | Copy files instead of symlinking |
| `-y, --yes` | Skip all confirmation prompts |
| `--all` | Install all skills to all agents without prompts |

### Examples

```bash
# List skills in a repository
npx skills add vercel-labs/agent-skills --list

# Install specific skills
npx skills add vercel-labs/agent-skills --skill frontend-design --skill skill-creator

# Install a skill with spaces in the name (must be quoted)
npx skills add owner/repo --skill "Convex Best Practices"

# Install to specific agents
npx skills add vercel-labs/agent-skills -a claude-code -a opencode

# Non-interactive installation (CI/CD friendly)
npx skills add vercel-labs/agent-skills --skill frontend-design -g -a claude-code -y

# Install all skills to specific agents
npx skills add vercel-labs/agent-skills --skill '*' -a claude-code
```

### Scope & Method

| Scope | Flag | Claude Code 路径 | Use Case |
| --- | --- | --- | --- |
| **Project** | (default) | `./.claude/skills/` | 随项目提交,团队共享 |
| **Global** | `-g` | `~/.claude/skills/` | 跨项目可用 |

| Method | Description |
| --- | --- |
| **Symlink** (Recommended) | 各 agent 到 canonical copy 的软链,单一真源,易更新 |
| **Copy** | 各 agent 独立副本,symlink 不支持时用 |

> 装完可直接检查 `./.claude/skills/<name>/SKILL.md`(或 `~/.claude/skills/...`)确认落地。

---

## `skills use` — 不安装,只用一次

```bash
npx skills use vercel-labs/agent-skills --skill web-design-guidelines            # prompt → stdout
npx skills use vercel-labs/agent-skills --skill web-design-guidelines --agent claude-code  # 交互式启动
```

`use` 解析 source 同 `add`,把所选 skill 写到临时目录,除非给 `--agent`,否则只把生成的 prompt 打到 stdout。给 `--agent` 则用该 prompt 启动对应 agent。

> 区别:`use` = 临时目录 + stdout prompt(不留常驻);`add` = 落盘到 agent skills 目录(常驻)。

---

## 其它命令

| 命令 | 说明 |
| --- | --- |
| `npx skills list` / `ls` | 列出已装 skill(类似 `npm ls`)。AI 自检"装了哪些/装在哪"用 |
| `npx skills find [query]` | 按关键词或交互式搜索 skill;`--owner <org>` 限定仓库 owner |
| `npx skills update [skills]` | 更新已装 skill 到最新 |
| `npx skills remove [skills]` / `rm` | 从 agent 卸载 skill |
| `npx skills init [name]` | 生成 SKILL.md 模板(skill 创建是 skill-forge 职责) |

### `list` — 自检已装

```bash
npx skills list                       # 全部(project + global)
npx skills ls -g                      # 仅 global
npx skills ls -a claude-code -a cursor  # 按 agent 过滤
```

### `update`

```bash
npx skills update my-skill -y              # 单个,非交互
npx skills update frontend-design web-design-guidelines  # 多个
npx skills update -g                       # 仅 global
npx skills update -p                       # 仅 project
npx skills update -y                       # 全部,非交互(自动判 scope:项目内→project,否则 global)
```

| Option | Description |
| --- | --- |
| `-g, --global` | 仅更新 global |
| `-p, --project` | 仅更新 project |
| `-y, --yes` | 跳过 scope prompt(自动判:在项目目录→project,否则 global) |
| `[skills...]` | 按名更新指定 skill |

### `remove` / `rm`

```bash
npx skills remove web-design-guidelines -y            # 单个
npx skills remove frontend-design web-design-guidelines  # 多个
npx skills remove --global web-design-guidelines       # 从 global 卸
npx skills remove --skill '*' -a claude-code -y        # 卸 claude-code 的全部 skill
npx skills remove my-skill --agent '*'                 # 从所有 agent 卸某 skill
npx skills rm my-skill                                 # rm 别名
```

| Option | Description |
| --- | --- |
| `-g, --global` | 从 global 卸(否则 project) |
| `-a, --agent` | 从指定 agent 卸(`'*'` = 全部) |
| `-s, --skill` | 指定要卸的 skill(`'*'` = 全部) |
| `-y, --yes` | 跳过确认 |
| `--all` | `--skill '*' --agent '*' -y` 的简写 |

---

## SKILL.md 格式与发现(装/卸时校验用)

skill 是含 `SKILL.md` 的目录,frontmatter:

```markdown
---
name: my-skill                      # 必填:唯一标识,小写+连字符
description: What this skill does   # 必填:做什么、何时用
metadata:
  internal: true                    # 可选:隐藏,仅 INSTALL_INTERNAL_SKILLS=1 时可见可装
---
```

**发现规则**(决定 `--list` 能看到什么):CLI 在仓库内的 skill 容器目录里,扁平布局(`skills/<name>/SKILL.md`)走一层、catalog 布局(`skills/<category>/<name>/SKILL.md`)多走一层;浅层 `SKILL.md` 遮蔽其下嵌套项。`--full-depth` 可发现容器目录之外的 `SKILL.md`(如 `examples/`、`tests/` 下)。标准位置无 skill 时回退递归搜索。

> Claude Code 相关的发现位置:`skills/` 与 `.claude/skills/`(其它 70+ agent 的目录对本 skill 无关)。

---

## Troubleshooting

- **"No skills found"**:仓库需含合法 `SKILL.md`,frontmatter 同时有 `name` 和 `description`。
- **Skill 不加载**:核对落地路径(project `./.claude/skills/<name>/SKILL.md`;global `~/.claude/skills/<name>/SKILL.md`);frontmatter 是合法 YAML。
- **Permission errors**:确认对目标目录有写权限。

---

## Environment Variables

| Variable | Description |
| --- | --- |
| `INSTALL_INTERNAL_SKILLS` | 设 `1` / `true` 以显示并安装 `metadata.internal: true` 的 skill |

```bash
INSTALL_INTERNAL_SKILLS=1 npx skills add vercel-labs/agent-skills --list
```

---

## 关键链接

- [Skills Directory](https://skills.sh) — 发现 skill
- [Agent Skills Specification](https://agentskills.io) — 跨 agent 规范
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [上游 vercel-labs/skills 仓库](https://github.com/vercel-labs/skills) — 完整 README、re-sync 来源
