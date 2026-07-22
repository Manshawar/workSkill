---
name: git-submit
description: "Git 自动提交：分析改动 → Conventional Commit 中文消息 → 按需拆 commit → fetch+rebase → push。识别 Gerrit vs 普通 git；Gerrit 两步推送 + Change-Id amend；读写 .git-submit.json pushStrategy。Use when: 提交代码, 提交一下, git submit, commit 并 push, 推送代码, 帮我提交, 提交并推送, 走 Gerrit Review, 提个 review, grp 推送。Not for: 只看 diff 不提交, 已有冲突未解, 跨多业务大改需人工规划(仍可触发但会先问拆分)。"
allowed-tools:
  - Bash(node **/git-submit/scripts/git-submit.js *)
  - Bash(git fetch:*)
  - Bash(git rebase:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git push:*)
  - Read(.git-submit.json)
  - Write(.git-submit.json)
  - Edit(.git-submit.json)
---

# git-submit

## Iron Law

默认自动，只在 5 门停下。禁止 `git pull` / `git stash`。采集一律 `node scripts/git-submit.js probe`；其后禁止再跑 status/diff/log/remote（不够只用 `probe --deep-diff|--deep-log`）。Node 只采集。

**有改动：先 commit → fetch+rebase → push。** 禁止先 rebase。Bash 理想 ≤4：probe → add+commit → fetch&&rebase → push（gerrit 两步可合并）。

**5 门**：①冲突 ②多业务拆分 ③危险文件 ④push 策略未知 ⑤多消息方案

## Parameters

默认全流程。`[--no-push] [--no-sync] [--amend] [--split]`

## Workflow

```
- [ ] Step 1: probe ⚠️ — 干净则结束
- [ ] Step 2: plan+commit ⛔ — 门2/3/5 → add+commit
- [ ] Step 3: sync ⛔ — fetch+rebase（--no-sync 跳过；冲突→门1）
- [ ] Step 4: push+report — 门4（若需）→ push → 短输出
```

### Step 1: probe

```bash
node scripts/git-submit.js probe
```

读工具 JSON，跟 `hints` / `bash_plan`。**勿**把完整 probe 贴给用户。`repo_root` 用于 git/写配置；`untracked_policy` 决定纳入/排除；`danger_hits`→门3；`push_strategy` unknown→门4；`amend.allowed` 决 amend。

### Step 2: plan + commit

1. 同业务 1 commit；跨无关业务→门2  
2. 消息 `<type>: <10~20字中文>`；type∈ feat/fix/refactor/style/docs/test/perf/build/ci/chore；多方案→门5；禁英文/路径/句号/"解决了"等  
3. `danger_hits` 非空→门3  
4. 在 `repo_root`：`git add <文件> && git commit -m "..."`；`amend.allowed` 或 `--amend` → `commit --amend --no-edit`。stdout 已有 hash→勿再 log。

### Step 3: sync

须在 commit 后。`git fetch origin && git rebase origin/<branch>`。冲突→门1，禁 `--skip`/push。

### Step 4: push + report

unknown→门4，写 `repo_root/.git-submit.json`：`{"pushStrategy":"gerrit"|"git"}`。

```bash
git push origin <branch>
# gerrit：
git push origin HEAD:refs/for/<branch> && git push origin <branch>
```

第1步失败（常缺 Change-Id）→停，禁跳步；第2步失败→停，不回退第1步。

对用户只输出：
```text
✅ 提交完成
Commit: / Branch: / Push: / Change-Id:(仅gerrit)
```
失败三行：原因 / 影响 / 下一步。

## Anti-Patterns

- ❌ probe 后再 diff/status/log；先 rebase/stash；Bash 无故>4  
- ❌ 倾倒 probe；pull；gerrit 跳步；amend 已共享 commit；无门乱问

## Checklist

- [ ] 1×probe（+可选 deep）；先 commit 后 sync；无 stash/pull  
- [ ] 仅命中才上门；对用户短输出
