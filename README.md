# workSkill

工作相关 Claude / Cursor / Codex 等通用 Agent 的 **Skills 集合仓库**，通过 [`npx skills`](https://github.com/vercel-labs/skills) 一键安装与更新。

> 一个仓库 = 一组 skills。每一个子目录都是符合 [Agent Skills 规范](https://agentskills.io) 的独立 skill（包含 `SKILL.md`，按需带 `scripts/` / `references/` / `assets/`）。

---

## 当前收录的 Skills

| Skill | 状态 | 说明 | 触发词 |
|---|---|---|---|
| [`skills/daily-report`](./skills/daily-report) | ✅ 可用 | 日报生成器：从当日 git commit 自动生成按小时填写、含【项目名】前缀的多项目并线日报 | `日报` / `daily report` / `写日报` / `生成日报` / `填一下今天干了啥` |
| [`skills/vf-fix`](./skills/vf-fix) | ✅ 可用 | 前端最小修复（vf 族）：优先代码+引用关系；缺关键信息先问用户，禁止猜着改；不够再开 agent-browser | `vf-fix` / `页面上不对帮我修` / `提交没反应` / `联调修 bug` / `e2e 失败修一下` |
| [`skills/vf-e2e`](./skills/vf-e2e) | ✅ 可用 | 低成本前端业务闭环验证（vf 族）：按业务逻辑走完「触发→处理→数据→反馈」四环；真实 UI 操作；产物在 `.verify/`；发现问题不修复 | `vf-e2e` / `验证业务流程` / `走一遍正常流程` / `业务验证` / `回归验证` |
| [`skills/vf-mry`](./skills/vf-mry) | ✅ 可用 | 前端问题经验沉淀（vf 族）：已确认问题/原因/约束写入本地 `.verify/knowledge/`；只记规则不修代码 | `vf-mry` / `沉淀经验` / `记规则` / `记录修复约束` / `E2E 失败后沉淀` |
| [`skills/git-submit`](./skills/git-submit) | ✅ 可用 | Git 自动提交 Agent：同步远程(rebase) → 分析 diff → 生成 Conventional Commit 中文消息 → 自动 push；自动识别 Gerrit(`HEAD:refs/for/分支`) vs 普通 git，已有 Change-Id 则 amend 续 Review；只在冲突/拆分/危险文件/推送类型/多消息方案 5 类硬决策处问用户 | `提交代码` / `提交一下` / `git submit` / `commit 并 push` / `推送代码` / `帮我提交` / `走 Gerrit Review` / `提个 review` |
| [`skills/skill-hub`](./skills/skill-hub) | 🚧 即将实现 | Skill 元数据 + 使用统计 + 推荐系统的注册中心。当前仅有设计文档与参考资料，实现日期待定 | — |

> **vf 族协作关系**：`vf-fix` 探+修 → `vf-e2e` 验不修 → `vf-mry` 沉淀不修。三个 skill 共享项目本地 `.verify/` 目录，互不污染业务代码。

---

## 安装

```bash
# 全局安装（推荐, 所有项目都能用）
npx skills add Manshawar/workSkill -g

# 项目级安装（只在该项目可用）
cd your-project && npx skills add Manshawar/workSkill

# 只装某一个 skill
npx skills add Manshawar/workSkill --skill daily-report -g
npx skills add Manshawar/workSkill --skill vf-fix -g
```

---

## 更新

```bash
npx skills update                   # 升级全部 skill
npx skills update daily-report      # 只升级某一个 skill
npx skills update daily-report -g   # 只升级全局安装的那一份
```

### 更新失败？通常是 GitHub 限流

匿名 API 每小时 60 次, 多人共用 IP / 跑 CI 时容易撞. 配一个 [GitHub PAT (Fine-grained, Contents: Read-only)](https://github.com/settings/tokens) 解决:

```bash
# macOS / Linux
echo 'export GITHUB_TOKEN=ghp_xxx' >> ~/.zshrc && source ~/.zshrc

# 或者让 npx skills 自己存
npx skills config set github.token ghp_xxx
```

`npx skills update` 自动读 `$GITHUB_TOKEN`, 验证: `curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit | grep remaining` 应返回 `5000` 而不是 `60`.

### 卸载

```bash
npx skills remove daily-report -g
```

---

## 减少批准弹窗（推荐首次配置）

Claude Code 默认每次 Bash / Read 都要用户点"Allow". 一次性预授权, 把以下加到 `~/.claude/settings.local.json` 的 `permissions.allow` (保留原有规则):

```json
{
  "permissions": {
    "allow": [
      "Read(/Users/*/.claude/skills/daily-report/**)",
      "Read(/Users/*/.agents/skills/daily-report/**)",
      "Read(/home/*/.claude/skills/daily-report/**)",
      "Bash(node /Users/*/.claude/skills/daily-report/scripts/*.js *)",
      "Bash(node /Users/*/.agents/skills/daily-report/scripts/*.js *)",
      "Bash(node /home/*/.claude/skills/daily-report/scripts/*.js *)"
    ]
  }
}
```

> **Windows**: 把 `/Users/*/` 替换成 `C:/Users/*/`. **WSL**: `/home/*/` 也保留.

---

## 仓库结构

```
workSkill/                          # ← GitHub 仓库根 (Manshawar/workSkill)
├── README.md                       # 本文件
├── .gitignore
│
├── skills/                         # ← 规范 skill 容器目录 (npx skills 发现入口)
│   ├── daily-report/
│   │   ├── SKILL.md
│   │   └── scripts/
│   │       └── daily-report.js     # 零依赖 Node.js；记忆写在包外 .daily-report/
│   ├── vf-fix/SKILL.md             # 修复
│   ├── vf-e2e/SKILL.md             # 验证
│   ├── vf-mry/SKILL.md             # 沉淀
│   └── skill-hub/                  # 🚧 即将实现
│       ├── DESIGN.md               # 设计文档 (registry-core / CLI / HTTP / UI / 推荐)
│       ├── reference/
│       │   ├── registry.json       # skill 原子化元数据库 (按 category 分类 + keepGlobal 标记)
│       │   └── skillsRef.md        # npx skills CLI 接口参考 (AI 调用速查)
│       ├── bin/                    # 命令层构建产物落地 (registry.js)
│       └── ui/                     # UI 构建产物落地 (dist/)
│
├── .daily-report/                  # daily-report 本地记忆+归档（gitignore；update skill 保留）
│   ├── setting.json                # 角色 / 仓库存档 / day_end_min
│   └── history/                    # 每次 emit 落盘：YYYY-MM-DD.md
│
└── .buildassets/                   # 外置源码工程 —— 构建产物拷入 skill 包随包分发
    └── skill-hub/                  # 与 skills/skill-hub/ 对应
        ├── registry-server/        # Node + tsup 命令层源码 (→ bin/registry.js)
        │   ├── src/registry.js     # 当前为骨架占位, 业务待写
        │   └── package.json
        └── registry-ui/            # React + Vite UI 源码 (→ ui/dist/)
            ├── src/App.jsx         # 当前为骨架占位, 业务待写
            └── package.json
```

> **`.buildassets/` 约定**：仓库内**不**直接开发 skill 源码。每个 skill 由 1+ 个 `.buildassets/<skill-name>/` 下的独立源码工程（Node / React / Rust …）构建后，产物落到 skill 目录随包分发。这样 skill 包始终是「构建产物」，可独立发版、可独立替换技术栈。

---

## License

仅供 Manshawar 个人使用.