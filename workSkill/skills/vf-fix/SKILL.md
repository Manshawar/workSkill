---
name: vf-fix
description: "浏览器证据驱动的前端最小修复（vf 族）。agent-browser 先探 network/console，再改代码。开发中或 vf-e2e FAIL 后用。Use when: vf-fix, 页面上不对帮我修, 提交没反应, 弹窗/列表状态错了, browser 看看再修, e2e 失败修一下, 联调修 bug。Not for: 只验证(→vf-e2e), 写测试平台, 扫全站, 无证据猜改, 只沉淀(→vf-mry)。"
---

# vf-fix

## Iron Law

**先浏览器证据，后最小改代码。无 network/console/状态证据 → 禁止改。**

证据优先级：`network → console → 文本/定位 → 截图(末手段,≤1张)`

Red Flags：无证据瞎改 · 大重构顺便优化 · spec 塞诊断 log · browser 闲逛整站 · 修完不说明改动

兄弟：`vf-e2e` 验不修 · `vf-fix` 探+修 · `vf-mry` 沉淀不修

## Workflow

```
vf-fix Progress:
- [ ] Step 1: 读 .verify/index.json（若有）⛔
- [ ] Step 2: 复现 — agent-browser 定点（遵循 agent-browser skill）
- [ ] Step 3: 取证 — 按优先级，取缺口即停
- [ ] Step 4: 原因不清 → 问用户 ⚠️（正确行为？异常？约束？）
- [ ] Step 5: 最小改代码（只碰相关文件）
- [ ] Step 6: browser 复核关键闭环点
- [ ] Step 7: 可选 — 提示 vf-e2e 重跑 / vf-mry 沉淀
```

Step 3 Ask：缺哪条证据才能定位？取到即回代码，禁止点点点当验证平台。

## 输出

```text
问题: <一句>
证据: <network/console/状态>
原因: <一句>
改动: <文件 + 改了什么>
复核: PASS|FAIL
下一步: vf-e2e | vf-mry | 无
```

## Anti-Patterns / Pre-Delivery

禁止：无证据改代码 · 改无关文件 · 造大量测试 · 逐步截图 · 诊断写进 spec

- [ ] 有证据链再改；改动最小
- [ ] 复核关键点；输出完整
- [ ] 未当 e2e 平台用
