---
name: vf-fix
description: "前端最小修复（vf 族）：优先靠代码与引用关系定位并修好；修不好再开 agent-browser 取证。开发中或 vf-e2e FAIL 后用。Use when: vf-fix, 页面上不对帮我修, 提交没反应, 弹窗/列表状态错了, 联调修 bug, e2e 失败修一下, browser 看看再修。Not for: 只验证(→vf-e2e), 写测试平台, 扫全站, 无证据猜改, 只沉淀(→vf-mry), 一上来就开 browser。"
---

# vf-fix

## Iron Law

**分级修复：能靠代码修好就不开 browser。无证据（代码或运行时）→ 禁止改。**

```text
L1 代码+引用（默认）→ L2 browser 取证（仅缺口）→ 最小改 → L3 复核
```

Red Flags：未读引用就开 browser · 无证据瞎改 · 大重构顺便优化 · spec 塞诊断 log · browser 闲逛整站

兄弟：`vf-e2e` 验不修 · `vf-fix` 探+修 · `vf-mry` 沉淀不修

## L1 何时够 / 何时上 L2

**L1 够**：异常栈、类型错误、逻辑/条件反了、import/调用链断了、与 `.verify/knowledge` 规则直接冲突。

**上 L2**：缺运行时状态、真实 DOM/网络、仅代码钉不死根因。

L1 必做：读报错/diff/相关源码（勿扫全库）→ 追引用（import · props/emit · store/API · 路由 · 父子调用）→ Ask：改 A 会不会打断 B？类型/默认值/异步是否一致？

L2 证据：`network → console → 文本/定位 → 截图(末手段,≤1张)`。遵循 agent-browser skill；取缺口即停。

## Workflow

```
vf-fix Progress:
- [ ] Step 1: 有则读 .verify/index.json；无则跳过
- [ ] Step 2: L1 代码 + 引用链 ⛔
- [ ] Step 3a (conditional): L1 钉死 → 最小改
- [ ] Step 3b (conditional): L1 不够 → L2 browser 取证 → 最小改
- [ ] Step 4: 仍不清 → 问用户 ⚠️（正确行为？异常？约束？）再改
- [ ] Step 5: L3 复核 — 优先静态/已有手段；关键闭环不定再用 browser 点关键点
- [ ] Step 6: 可选 → vf-e2e / vf-mry
```

## 输出

```text
层级: L1|L1+L2
问题: <一句>
证据: <代码引用/报错 或 network/console>
原因: <一句>
改动: <文件 + 改了什么>
复核: PASS|FAIL
下一步: vf-e2e | vf-mry | 无
```

## Anti-Patterns / Pre-Delivery

禁止：跳过 L1 直接 browser · L2 取证后不改就结束 · 无证据改代码 · 改无关文件 · 造大量测试 · 逐步截图 · 诊断写进 spec

- [ ] 先走完 L1 引用分析；browser 仅因缺口
- [ ] 有证据链且已最小改；输出含「层级」
- [ ] L3 复核完成
