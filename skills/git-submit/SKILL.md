---
name: git-submit
description: "本地改动分类并 commit：一次 probe 看 diff → 写 Conventional 中文消息 → 脚本内提交。不做 fetch/rebase/pull/push。Use when: 提交代码, 帮我 commit, 分类改动, git submit, 写 commit message, 拆 commit。Not for: 推送/同步远程, 只看不提交, 冲突未解。"
allowed-tools:
  - Bash(node **/git-submit/scripts/commit.js *)
---

# git-submit

## Iron Law

只做分类 + 本地 commit。禁止 `git` 直调（add/commit/fetch/push/status/diff 全部禁止）。一律：
```bash
node scripts/commit.js probe
node scripts/commit.js commit -m "<type>: <描述>"
```
禁止读业务源码；不够分类只用再跑 `probe --deep-diff`。禁止把 probe/patch 全文贴给用户。

Bash ≤2。才问：冲突；跨无关多业务拆分；密钥/证书（脚本对 secret/cert 会直接 fail）。

## Parameters

`[--dry-run] [--amend] [--split]`；拆分时多次 `commit --files ... -m "..."`。

## Workflow

```
- [ ] 1 probe
- [ ] 2 定消息（/拆分）
- [ ] 3 commit.js commit -m "..." → 短输出
```

### probe
`clean`→结束。看 `paths`/`stat`/`types`/`files`。`gate=conflict|danger`→停。`danger_soft`可继续。

### 消息
`<type>: <10~20字中文>`；type∈ feat/fix/refactor/style/docs/test/perf/build/ci/chore。禁英文/路径/句号/"解决了"。

### commit
```bash
node scripts/commit.js commit -m "feat: 描述"
# 指定文件（拆 commit）：
node scripts/commit.js commit -m "fix: 描述" --files a.vue b.js
# 只看不提交：
node scripts/commit.js commit -m "feat: 描述" --dry-run
```
成功 JSON 含 `hash`/`message`。对用户只回：`✅ Commit: <message> (<hash>)` +「同步/推送请自行处理」。
