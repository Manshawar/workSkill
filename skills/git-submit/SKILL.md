---
name: git-submit
description: "Git 自动提交：分析改动 → fetch+rebase 同步 → Conventional Commit 中文消息 → 按需拆 commit → 自动 push。自动识别 Gerrit vs 普通 git（github/gitlab/gitee）；Gerrit 两步推送 + Change-Id amend 续 Review；读/写 .git-submit.json 的 pushStrategy。Use when: 提交代码, 提交一下, git submit, commit 并 push, 推送代码, 帮我提交, 提交并推送, 走 Gerrit Review, 提个 review, grp 推送。Not for: 只看 diff 不提交, 已有冲突未解, 跨多业务大改需人工规划(仍可触发但会先问拆分)。"
allowed-tools:
  - Bash(node **/git-submit/scripts/git-submit.js *)
  - Bash(git fetch:*)
  - Bash(git rebase:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git push:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Read(.git-submit.json)
  - Write(.git-submit.json)
  - Edit(.git-submit.json)
---

# git-submit

## Iron Law

**默认自动执行，只在 5 类硬决策处停下。冲突未解 / 危险文件未确认 / push 策略未定 → 禁止对应动作。禁止 `git pull`（只用 fetch+rebase）。**

**信息采集一律** `node scripts/git-submit.js probe`（只读 JSON）。禁止为 status/log/remote/config/amend 探测再拆 Bash。Node **只**做采集，不做 commit/push/rebase。**不**预检 commit-msg hook（子目录开 IDE 易误判；缺 Change-Id 由 push 失败处理）。

**5 个必问门**（其余勿打扰）：
1. Merge Conflict
2. 多业务需拆 commit
3. 危险文件（密钥/证书/大规模删除/DB 迁移/CI）
4. Push 类型无法判定
5. Commit Message 多方案

Red Flags：冲突还 `--skip`；有密钥还 `git add -A`；策略未定就 push；一 commit 塞多无关业务；Gerrit 未共享+Change-Id 却新建而非 amend；amend 已共享 commit；`git pull`；gerrit 跳过 `refs/for`。

## Parameters

| 参数 | 默认 | 说明 |
|---|---|---|
| (无) | — | 同步→分析→commit→push |
| `--no-push` | false | 只 commit 不 push |
| `--no-sync` | false | 跳过 fetch+rebase |
| `--amend` | false | 强制 amend HEAD |
| `--split` | — | 显式要求拆分 |

**argument-hint**: `[--no-push] [--no-sync] [--amend] [--split]`

## Workflow

```
git-submit Progress:
- [ ] Step 1: probe ⚠️ REQUIRED — 一次采集；非仓库/无改动则结束
- [ ] Step 2: sync ⛔ — fetch+rebase（--no-sync 跳过；冲突→门1）
- [ ] Step 3: plan+commit ⛔ — 拆分/消息/危险/amend（门2/3/5）→ commit
- [ ] Step 4: push+report — 策略（门4）→ push → 输出
```

## Step 1: probe ⚠️ REQUIRED

```bash
PROBE=$(node scripts/git-submit.js probe)
# 大 diff 不够判拆分时再：node scripts/git-submit.js probe --deep-diff
# 消息格式拿不准时再：node scripts/git-submit.js probe --deep-log
```

读 JSON，关键字段：

| 字段 | 用法 |
|---|---|
| `ok` / `is_git` / `clean` | 非仓库或干净 → 告知并**结束** |
| `cwd` / `repo_root` | 工作目录 vs 仓库根（子目录开 IDE 时不同）；写 `.git-submit.json` 用 `repo_root` |
| `branch` / `remotes` | sync/push 目标 |
| `status.*` / `untracked_policy` | add 范围；`include_default` 纳入，`exclude_default` 排除 |
| `diff_stat` / `diff_name_only` | 拆分判定；不够再 `--deep-diff` 或 `git diff -- <path>` |
| `danger_hits` | 非空 → 门3 |
| `push_strategy` / `*_source` | `config` > `remote` > `unknown`（→门4） |
| `amend` | `allowed` / `reason`；Gerrit 续 Review 用 |
| `recent_log` | type 习惯；懒采集（干净+纯 git 可能 `checked:false`） |
| `hints[]` | 已标可能命中的门，优先处理 |

未跟踪：**纳入**同模块新源码/配置；**排除** log/tmp/node_modules/dist/build/.DS_Store。不确定密钥 → 门3。

## Step 2: sync ⛔

`--no-sync` 跳过。禁止 `git pull`：

```bash
git fetch origin
git rebase origin/<branch>    # branch = probe.branch
```

- 成功 → Step 3
- 冲突 → **门1**，输出冲突文件+原因+建议；未解决前禁止 commit/push/`--skip`。用户解完后重新触发。

sync 后若工作区变化大，可再跑一次 `probe`（仍只 1 次 Bash 包装）。

## Step 3: plan + commit ⛔

1. **拆分**：同一业务目的 → 1 commit；跨无关业务 → **门2**（`--split` 也走门2 确认）
2. **消息**：格式 `<type>: <中文一句话>`；多方案 → **门5**，唯一合理 → 直接用
   - type 仅：`feat` / `fix` / `refactor` / `style` / `docs` / `test` / `perf` / `build` / `ci` / `chore`
   - 简体中文 **10~20 字**；写修改目的；推荐动词：新增/修复/优化/调整/重构/升级/更新/完善
   - 允许业务宾语；**禁止**英文、文件路径、实现细节堆砌、句号、"解决了/完成了/支持了"
   - 默认 Conventional Commit；仅用户明确「沿用旧格式」才跟 `probe.recent_log.type_samples`
3. **危险**：`danger_hits` 非空 → **门3**
4. **commit / amend**：
   - 默认新建：`git add <文件>` + `git commit -m "<type>: <描述>"`（精确 add；用 untracked_policy）
   - **允许 amend**（续同一 Review）：`probe.amend.allowed` **或** 用户 `--amend`
     → `git commit --amend --no-edit`（改消息须保留 Change-Id）
   - `amend.allowed==false` 且无 `--amend` → **禁止** amend 已共享 HEAD，走新建
   - `--split` / 门2 → 按文件组分次 add+commit

完成后 `git log -1 --format='%H %s'` 确认。**不**预检 hook；若 commit 后无 Change-Id，push 第 1 步失败时再按下方处理。

## Step 4: push + report

策略已在 probe：`config` / `remote` 直接用；`unknown` → **门4**，选后写回：

```json
{ "pushStrategy": "gerrit" | "git", "branch": "<可选>" }
```

`<branch>` = config.branch || probe.branch。`--no-push` 跳过 push。

```bash
# git
git push origin <branch>

# gerrit：两步，禁止跳步
git push origin HEAD:refs/for/<branch>
git push origin <branch>
```

**gerrit 失败**：
- 第 1 步失败 → 多为缺 Change-Id（hook 未装或不生效）。停，提示用户装 hook 后重试。**禁止**跳过第 1 步直接第 2 步。
- 第 1 步成功、第 2 步失败 → 多为分支保护。停，告知用户，**不要**回退第 1 步。

Change-Id：`git log -1 --format='%b'` 中的 `Change-Id:` 行（仅 gerrit 输出）。

### 输出

成功：
```text
✅ 提交完成
Commit:  <message>
Branch:  <branch>
Push:    <实际命令；gerrit 两行>
Change-Id: <仅 gerrit>
```

失败（仅三行）：
```text
❌ 失败原因: <一句>
影响范围: <已做/未做>
下一步建议: <具体动作>
```

## Anti-Patterns

- ❌ 拆多次 Bash 采 status/log/remote/config（应用 probe）
- ❌ Node 脚本里 commit/push/rebase
- ❌ 冲突未解就提交；有密钥还 `git add -A`；策略未定就 push
- ❌ `git pull`；gerrit 跳过 refs/for / 第1步失败硬走第2步 / 第2步失败回退第1步
- ❌ amend 已共享 commit；有 Change-Id 未共享却新建（应 amend）
- ❌ 无冲突/单业务/无危险还反复问；未跟踪源码还弹问（应按 policy 自动）
- ❌ 英文消息 / 带路径 / type 表外 type

## Pre-Delivery Checklist

- [ ] 只用 probe 采集；clean/非 git 已结束
- [ ] 冲突停门1；未用 pull
- [ ] 多业务走门2；danger 走门3；策略 unknown 走门4 并写配置
- [ ] 消息 `<type>: <10~20字中文>`，type 在 10 取值内；两步 push/amend 按正文；**未**预检 hook
- [ ] 输出含 Commit/Branch/Push（Gerrit 含 Change-Id）
