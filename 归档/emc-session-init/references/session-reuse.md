# Session 复用与失效

> init 跑通后，`/tmp/emc-session.json` 覆盖 `user-betacloud` + `work-betacloud` + `eapps-betacloud`。后续脚本加载即可跳过 SSO。

## 目录

- [直接复用](#直接复用)
- [检查 session 域覆盖](#检查-session-域覆盖)
- [session 失效](#session-失效)
- [多账号隔离](#多账号隔离)

## 直接复用

`newContext({ storageState })` 即带三域 cookie：

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: '/tmp/emc-session.json',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  await page.goto('https://eapps-betacloud.e.lanxin.cn/...', { waitUntil: 'networkidle' });
  console.log('url:', page.url()); // should NOT match /passport/

  await browser.close();
})();
```

```bash
cd .claude/skills/playwright-skill && node run.js /tmp/your-script.js
```

## 检查 session 域覆盖

```bash
node -e "
const s = require('/tmp/emc-session.json');
console.log('origins:');
(s.origins || []).forEach(o => console.log('  ', o.origin));
console.log('cookies:', (s.cookies || []).length);
"
```

Expect ≥3 origins: `user-betacloud`、`work-betacloud`、`eapps-betacloud`。缺域 → 对应请求 401 → 重跑 init。

## session 失效

**症状**：加载后 URL 进 `passport/pc/...`，或接口 401。

**原因**：服务端 TTL 有限；storageState 不续期。

**处理**：
1. `rm /tmp/emc-session.json`
2. SKILL.md 重跑 init
3. Step 3 验证后再用

别修补过期 session —— 直接重跑。

## 多账号隔离

每账号一份 config + 分开的 `--session-out`：

```bash
node run.js ../emc-session-init/scripts/init.js -- \
  --config /path/to/config-accountA.json --session-out /tmp/emc-session-A.json

node run.js ../emc-session-init/scripts/init.js -- \
  --config /path/to/config-accountB.json --session-out /tmp/emc-session-B.json
```

或 CLI 临时覆盖：

```bash
node run.js ../emc-session-init/scripts/init.js -- \
  --account ACCOUNT_B --access-key KEY_B --verify-token 000000 \
  --session-out /tmp/emc-session-B.json
```

Session 文件无明文 accessKey，但含 cookie，**仍敏感**，勿提交。
