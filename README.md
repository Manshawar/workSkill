# workSkill

工作相关 Claude / Cursor / Codex 等通用 Agent 的 **Skills 集合仓库**，通过 [`npx skills`](https://github.com/vercel-labs/skills) 一键安装与更新。

> 一个仓库 = 一组 skills。每一个子目录都是符合 [Agent Skills 规范](https://agentskills.io) 的独立 skill（包含 `SKILL.md`，按需带 `scripts/` / `references/` / `assets/`）。

## 当前收录的 Skills

| Skill | 说明 | 触发词 |
|---|---|---|
| [`workSkill/daily-report`](./workSkill/daily-report) | 日报生成器：从当日 git commit 自动生成按小时填写、含【项目名】前缀的多项目并线日报 | `日报` / `daily report` / `写日报` / `生成日报` / `填一下今天干了啥` |

---

## 安装

```bash
# 全局安装（推荐, 所有项目都能用）
npx skills add Manshawar/workSkill -g

# 项目级安装（只在该项目可用）
cd your-project && npx skills add Manshawar/workSkill

# 只装某一个 skill
npx skills add Manshawar/workSkill --skill daily-report -g
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
workSkill/                # ← GitHub 仓库根
├── README.md                   # 本文件
└── workSkill/            # ← skill 容器目录
    └── daily-report/
        ├── SKILL.md
        └── scripts/
            └── daily-report.js   # 零依赖 Node.js, 7 个子命令: init / gather / save-repo / list-repos / set-display-name / clipboard / emit
```

> 多一层 `workSkill/` 是因为一个仓库可能装多个 skill, 每个 skill 在 `workSkill/<skill-name>/SKILL.md` 路径.

---

## License

仅供 Manshawar 个人使用.
