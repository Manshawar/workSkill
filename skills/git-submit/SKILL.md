---
name: git-submit
description: "Git 自动提交 Agent：分析改动 → 同步远程(rebase) → 生成 Conventional Commit 中文消息 → 拆分 commit → 自动 push。自动识别 Gerrit(gerrit/review/refs/for/Gerrit SSH) vs 普通 git(github/gitlab/gitee)，Gerrit 走 HEAD:refs/for/分支，已有 Change-Id 则 amend 不新建 Review。读取 .git-submit.json 配置 pushStrategy。Use when: 提交代码, 提交一下, git submit, commit 并 push, 推送代码, 帮我提交, 提交并推送, 走 Gerrit Review, 提个 review。Not for: 只看 diff 不提交(直接 git diff), 已有冲突要手动解(先解决再触发), 跨多业务大改需要人工拆分规划(仍可触发但会先问)。"
allowed-tools:
  - Bash(git status)
  - Bash(git status:*)
  - Bash(git fetch:*)
  - Bash(git pull:*)
  - Bash(git rebase:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git show:*)
  - Bash(git branch:*)
  - Bash(git remote:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git push:*)
  - Bash(git rev-parse:*)
  - Bash(git config:*)
  - Bash(cat .git-submit.json)
  - Read(.git-submit.json)
  - Read(.git/hooks/commit-msg)
---

# git-submit

## Iron Law

**默认自动执行，只在 5 类硬决策处停下问用户。冲突未解禁止提交；危险文件未确认禁止提交；push 策略未定禁止 push。**

```text
检查改动 → fetch+rebase(冲突则停) → 分析 diff(多业务则问拆分) → 生成消息 → 危险文件检查 → commit → 判定 push 策略(未定则问) → push → 输出
```

**5 个必问门**（其余一律自动，勿打扰）：
1. Merge Conflict —— 停，给冲突文件+原因+建议，等用户解
2. 多业务改动需拆 commit —— 问是否拆 / 怎么拆
3. 危险文件（.env/密钥/证书/大规模删除/DB 迁移/CI）—— 问是否继续
4. Push 类型无法判定 —— 问 Gerrit 还是普通 git
5. Commit Message 有多个合理方案 —— 问选哪个

Red Flags（出现就回退到对应门，别硬走）：
- rebase 出冲突还 `git rebase --skip` / 强行 `--continue` 带冲突标记
- 检测到 `.env`/密钥还直接 `git add -A`
- push 策略没定就 `git push` 裸推
- 一个 commit 塞了登录+订单+权限三个不相关模块
- Gerrit 项目里 HEAD 已有 Change-Id 却新建 commit 而非 amend
- amend 了别人/已共享的 commit

## Parameters

| 参数 | 默认 | 说明 |
|---|---|---|
| (无) | — | 自动走完整流程：同步→分析→commit→push |
| `--no-push` | false | 只 commit 不 push（仍走同步+分析+commit） |
| `--no-sync` | false | 跳过 fetch+rebase（仅在已知干净时用） |
| `--amend` | false | 强制 amend 到 HEAD commit（Gerrit 续 Review 常用） |
| `--split` | — | 显式要求按业务拆分多个 commit |

**argument-hint**: `[--no-push] [--no-sync] [--amend] [--split]`

## Workflow

```
git-submit Progress:
- [ ] Step 1: 检查仓库状态 ⚠️ REQUIRED — 非仓库/无改动则结束
- [ ] Step 2: 同步远程 fetch+rebase ⛔ — 冲突则停在门1
- [ ] Step 3: 分析 diff → 判定是否拆 commit（多业务则停门2）
- [ ] Step 4: 学习仓库 commit 风格（最近 30~50 条）
- [ ] Step 5: 生成 Conventional Commit 中文消息（多方案则停门5）
- [ ] Step 6: 危险文件检查（命中则停门3）
- [ ] Step 7: 检查 Gerrit commit-msg hook（缺则提醒，不自动装）
- [ ] Step 8: commit（--amend / --split 按策略）
- [ ] Step 9: 判定 push 策略（未定则停门4）→ push
- [ ] Step 10: 输出结果
```

## Step 1: 检查仓库状态 ⚠️ REQUIRED

```bash
git rev-parse --is-inside-work-tree   # 非仓库 → 告知并结束
git branch --show-current             # 当前分支
git remote -v                         # remote 配置（Step 9 判定用）
git status --short                    # 工作区改动
```

**`git status --short` 无输出 → 直接结束**，告知"工作区干净，无改动可提交"。

有改动 → 进 Step 2。改动含未跟踪文件时，Ask：是否纳入本次提交？（除非明显是该提交的新文件，默认纳入）。

## Step 2: 同步远程 fetch + rebase ⛔

```bash
git fetch origin
git rebase origin/<当前分支>      # 优先 rebase，保持线性
```

- 无冲突 / 自动完成 → 继续 Step 3，**不问用户**。
- 冲突 → **立刻停（门1）**，输出：
  ```text
  ⛔ Merge Conflict
  冲突文件: <git status --short 里 UU/AA 的文件列表>
  原因分析: <一句话，基于冲突内容判断，如"双方都改了同函数签名">
  建议处理: <保留双方/择一/手动合并的具体建议>
  下一步: 解决后 git add <文件> && git rebase --continue，或 git rebase --abort 放弃
  ```
  **冲突未解决前禁止 commit、禁止 push、禁止 `--skip`。** 等用户处理后由用户重新触发。

`--no-sync` 跳过本步。

## Step 3: 分析 diff → 拆分判定

```bash
git diff --stat                 # 改动文件+行数概览
git diff                        # 完整 diff（大改时按文件读）
```

按「修改目的 + 模块归属」归类。Ask 自己：**这些改动是否服务于同一个业务目的？**

- 同一功能（如登录页 UI + 登录接口对接）→ **一个 commit**，继续。
- 跨多个不相关业务（如登录 + 订单 + 权限）→ **停门2**，AskUserQuestion 给拆分方案：
  - 选项示例：「按模块拆 3 个 commit」「合并 1 个」「只提交其中某模块」
  - 用户选后按选择执行（`git add <文件组>` 分批 commit）。

`--split` 显式要求拆分时，直接给出拆分方案让用户确认（仍走门2）。

## Step 4: 学习仓库 commit 风格

```bash
git log --oneline -30            # 看最近 30 条（大仓库可到 50）
```

观察：
- type 用法（是否统一用 Conventional Commit，还是混用 `[fix]` 等旧格式）
- 中文描述风格、常用动词、长度
- 是否带 Change-Id（Gerrit 项目特征）

**生成消息时优先匹配本仓库历史风格**。若历史用旧格式（如 `[fix] xxx`），仍按本 skill 的 Conventional Commit 规范生成，除非用户明确要求沿用旧格式。

## Step 5: 生成 Commit Message

格式固定：`<type>: <中文一句话描述>`

### type 取值（仅这 10 个）

| type | 触发条件 |
|---|---|
| feat | 新增业务能力 |
| fix | 修复 Bug |
| refactor | 结构调整，不改功能 |
| style | 纯 UI/样式 |
| docs | 文档 |
| test | 测试 |
| perf | 性能优化 |
| build | 构建相关 |
| ci | CI/流水线 |
| chore | 其它（依赖升级、杂项） |

### 描述规则

- 简体中文，一句话，**10~20 个汉字**
- 简洁描述**修改目的**，不是实现过程
- 推荐动词：新增 / 修复 / 优化 / 调整 / 重构 / 升级 / 更新 / 完善

**禁止**：英文描述 · 文件路径 · 模块名 · 详细实现 · 句号 · "解决了"/"完成了"/"支持了"

### 示例

```
feat: 新增车辆导出功能
fix: 修复登录异常
refactor: 重构用户模块
style: 调整页面样式
docs: 更新接口文档
test: 增加登录测试
perf: 优化列表性能
build: 调整构建配置
ci: 更新流水线配置
chore: 升级依赖版本
```

**有 2+ 个同样合理的消息方案 → 停门5**，AskUserQuestion 让用户选；只有唯一合理方案 → 直接用，不问。

## Step 6: 危险文件检查 ⚠️

提交前扫描 `git status --short` + diff，命中下列任一 → **停门3**，AskUserQuestion 是否继续：

| 危险类型 | 识别特征 |
|---|---|
| 密钥/凭据 | `.env` / `*.key` / `*.pem` / `id_rsa` / 含 `secret`/`password`/`token=` 的配置 |
| 证书 | `*.crt` / `*.p12` / `*.cer` |
| 大规模删除 | 单次删除 > 200 行或整文件删除 ≥ 3 个 |
| 数据库迁移 | `migration`/`schema`/`*.sql` 的破坏性变更（DROP/ALTER） |
| CI 修改 | `.github/workflows/` / `.gitlab-ci.yml` / `Jenkinsfile` |

未命中 → 继续，**不问**。

## Step 7: 检查 Gerrit commit-msg hook

```bash
test -f .git/hooks/commit-msg && head -5 .git/hooks/commit-msg
```

- 存在且含 `Change-Id` → Gerrit hook 正常，继续。
- 不存在 + Step 9 判定为 Gerrit 项目 → **提醒用户**（不自动安装，避免覆盖/网络风险）：
  ```text
  ⚠️ Gerrit 项目缺少 commit-msg hook，无法自动生成 Change-Id。
  建议：在 Gerrit Web → Settings → HTTP Credentials 复制安装命令，或手动执行
  curl -Lo .git/hooks/commit-msg <gerrit>/tools/hooks/commit-msg && chmod +x .git/hooks/commit-msg
  安装后重新触发本 skill。
  ```
  此情况下仍可继续 commit（Change-Id 缺失会被 Gerrit 服务端拒，push 阶段会暴露），但明确告知风险。

普通 git 项目跳过本步。

## Step 8: Commit

```bash
git add <文件>                       # 精确 add，非必要时不用 -A
git commit -m "<type>: <描述>"
```

- `--amend` 或 HEAD commit 已含 `Change-Id` 且属同一 Review → `git commit --amend --no-edit`（保留原消息和 Change-Id，不新建 Review）。**禁止 amend 已 push/共享的 commit。**
- `--split` / 门2 拆分 → 按文件组分多次 `git add` + `git commit`。

commit 后确认：`git log -1 --format='%H %s'`。

## Step 9: 判定 Push 策略 → Push

按优先级判定 `pushStrategy`：

### 1) 项目配置 `.git-submit.json`（最高优先级）

```bash
cat .git-submit.json     # {"pushStrategy":"gerrit","branch":"master"}
```
有 `pushStrategy` → 直接用，不问。

### 2) 自动识别 remote（`git remote -v`）

| remote 特征 | pushStrategy |
|---|---|
| 含 `gerrit` / `review` / `refs/for` / Gerrit SSH 地址 | gerrit |
| 含 `github` / `gitlab` / `gitee` / 普通 git remote | git |

### 3) 无法判定 → 停门4

AskUserQuestion：「Gerrit Review 提交 / 普通 Git Push」，选后**写回 `.git-submit.json`** 留存，下次不再问。

### Push 命令

```bash
# git 策略
git push origin <branch>

# gerrit 策略（固定格式）
git push origin HEAD:refs/for/<branch>
```

`<branch>` 优先取 `.git-submit.json.branch`，否则取当前分支。`--no-push` 跳过本步。

## Step 10: 输出

### 成功

```text
✅ 提交完成

Commit:  <commit message>
Branch:  <branch>
Push:    <实际执行的 push 命令>
Change-Id: <Gerrit 项目提取，普通 git 项目省略本行>
```

Change-Id 从 `git log -1` 的 message trailer 提取：`git log -1 --format='%b' | grep Change-Id`。

### 失败

只输出三行，不啰嗦：

```text
❌ 失败原因: <一句话>
影响范围: <已做/未做，如"已 commit 未 push">
下一步建议: <具体动作>
```

## Anti-Patterns

**流程层**：
- ❌ 冲突未解就 `git rebase --skip` / 带 `<<<<<<<` 标记 `--continue` / 直接 commit
- ❌ 检测到 `.env`/密钥还 `git add -A` 一把梭
- ❌ push 策略没定就裸 `git push`（普通项目误推成 Gerrit 或反之）
- ❌ Gerrit 项目 HEAD 已有 Change-Id 还新建 commit（应 amend 续 Review）
- ❌ amend 已 push / 别人基于其开发的 commit
- ❌ 一个 commit 塞登录+订单+权限等不相关模块
- ❌ 跨业务大改不问用户直接合并成一个 commit

**消息层**：
- ❌ 英文描述 / 带文件路径 / 带模块名 / 描述实现过程
- ❌ 超 20 字或不足 10 字（除非改动极简）
- ❌ 用了 type 取值表外的 type / 句号结尾 / "解决了/完成了/支持了"

**打扰层**：
- ❌ 无冲突、单业务、无危险文件还反复问用户确认（应自动执行）
- ❌ push 策略已配置/可识别还弹门4 问用户

## Pre-Delivery Checklist

- [ ] 工作区无改动时已直接结束，未空跑 commit
- [ ] 冲突场景已停在门1，未 skip/强推
- [ ] 多业务改动已走门2 拆分确认
- [ ] commit message 格式 `<type>: <10~20 字中文>`，type 在 10 个取值内，无禁用词
- [ ] 危险文件已走门3 确认
- [ ] push 策略由配置/remote 识别，无法识别才走门4 并写回 `.git-submit.json`
- [ ] Gerrit 项目用 `HEAD:refs/for/<branch>`，已有 Change-Id 用 amend
- [ ] 输出含 Commit/Branch/Push（Gerrit 另含 Change-Id），失败只输出三行
