---
name: playwright-skill
description: 浏览器自动化（基于 Playwright）。用于网页功能验证、截图、跨设备响应式检查、表单流程自动化、检查链接、模拟用户操作等场景。触发关键词：浏览器自动化、跑一下页面、打开 XX 截图、检测响应式、检查死链。进不去后台 / 被 SSO 拦 / 无 session 时转调 emc-session-init（勿手写 SSO、勿读 secrets）。
---

# Playwright 浏览器自动化

通过 Playwright 启动 Chromium，编写脚本完成浏览器自动化任务。
临时探针脚本可写 `/tmp/playwright-test-*.js`；**依赖 `__dirname` / 旁路 config 的完整 skill 脚本**用原路径交给 `run.js`（勿先 cp 到 `/tmp`）。执行时浏览器**默认可见**（便于观察和调试）。

## 何时使用

适合：

- 打开浏览器访问本地或线上页面，验证功能
- 自动填写表单、模拟登录流程
- 多视口截图做响应式对比
- 检查页面链接是否失效
- 任何需要"模拟真实用户在浏览器里点一点"的任务

不适合：

- 纯 HTTP 接口测试（直接用 `curl` 即可）
- 大规模爬虫（用专门的爬虫框架更合适）
- 移动原生 App 自动化（用 Appium 等）

## 进不去后台 / 被 SSO 拦 → 调 `emc-session-init` ⛔

以下任一出现，**先停当前脚本，转调 `emc-session-init` skill**，勿自己手写 SSO 填表、勿把 secrets 贴进对话：

| 信号 | 例子 |
| --- | --- |
| URL 进 `/passport/` | 打开后台 / 应用详情被踢回 |
| 缺 session | `/tmp/emc-session.json` 不存在或失效 |
| 进不了后台 | 无「前往后台」、新标签页超时、一直停在 SSO |
| 像权限门 | 未授权页、空白、反复跳转 SSO（先当 session 问题，不猜业务权限） |

**怎么调（脱敏）**：

1. `test -f` 查 `config.local.json` / `ui.local.json` **存在即可，禁止 Read 内容**
2. 原路径跑 init（见 `emc-session-init` SKILL Step 2）
3. 日志里只看步骤 ok/fail、hostname 是否离开 passport；**account / accessKey / verifyToken / UI 明文不要复述进回复**
4. init 成功 → 用 `storageState: '/tmp/emc-session.json'` 重跑原 playwright 脚本
5. init 仍失败 → 报告用户「SSO 未过，请本地核 config」；**不要**为排错打开敏感文件

> 一句话：**卡在门禁 = 调 `emc-session-init`；本 skill 只管门后操作。**

## 准备（首次执行一次）

```bash
cd $SKILL_DIR          # 本 skill 所在目录
npm install            # 安装 playwright
npx playwright install chromium   # 安装 Chromium 浏览器
```

之后每次使用无需重装。

## 工作流（4 步走完）

### 步骤 1：探测本地服务（仅在测 localhost 时）

测本地服务前**必须**先探测端口，避免硬编码：

```bash
cd $SKILL_DIR && node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
```

- 找到 1 个 → 直接使用，并告诉用户
- 找到多个 → 让用户选一个
- 都没找到 → 让用户提供 URL，或问是否要帮启动服务

### 步骤 2：编写脚本到 /tmp

```javascript
// /tmp/playwright-test-page.js
const { chromium } = require('playwright');

// 从步骤 1 得到，或用户给出
const TARGET_URL = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({ headless: false }); // 默认可见
  const page = await browser.newPage();

  await page.goto(TARGET_URL);
  console.log('标题：', await page.title());

  await page.screenshot({ path: '/tmp/screenshot.png', fullPage: true });
  console.log('✅ 截图已存到 /tmp/screenshot.png');

  await browser.close();
})();
```

### 步骤 3：执行

```bash
# 临时探针（写在 /tmp）
cd $SKILL_DIR && node run.js /tmp/playwright-test-page.js

# 完整 skill 脚本（原路径，保留 __dirname；可透传参数）
cd $SKILL_DIR && node run.js ../emc-session-init/scripts/init.js -- --entry-url 'URL'
```

### 步骤 4：汇报结果

告诉用户：

- 浏览器行为是否符合预期
- 关键 `console.log` 输出
- 截图 / 数据文件已写入 `/tmp/`

## 常用模式（Examples）

### 例 1：多视口响应式截图

```javascript
const TARGET_URL = 'http://localhost:3001';
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet',  width:  768, height: 1024 },
  { name: 'mobile',  width:  375, height:  667 },
];

for (const v of viewports) {
  await page.setViewportSize({ width: v.width, height: v.height });
  await page.goto(TARGET_URL);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `/tmp/${v.name}.png`, fullPage: true });
  console.log(`✅ ${v.name} (${v.width}x${v.height}) 截图完成`);
}
await browser.close();
```

### 例 2：表单提交

```javascript
const TARGET_URL = 'http://localhost:3001';
const browser = await chromium.launch({ headless: false, slowMo: 50 });
const page = await browser.newPage();

await page.goto(`${TARGET_URL}/contact`);
await page.fill('input[name="name"]',    '张三');
await page.fill('input[name="email"]',   'test@example.com');
await page.fill('textarea[name="message"]', '测试');
await page.click('button[type="submit"]');
await page.waitForSelector('.success-message');
console.log('✅ 表单提交成功');
await browser.close();
```

### 例 3：登录流程

```javascript
const TARGET_URL = 'http://localhost:3001';
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

await page.goto(`${TARGET_URL}/login`);
await page.fill('input[name="email"]',    'user@example.com');
await page.fill('input[name="password"]', 'password123');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
console.log('✅ 登录成功，已跳转到 dashboard');
await browser.close();
```

### 例 4：检查死链

```javascript
const TARGET_URL = 'http://localhost:3001';
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto(TARGET_URL);

const links = await page.locator('a[href^="http"]').all();
let ok = 0, broken = [];

for (const link of links) {
  const href = await link.getAttribute('href');
  try {
    const res = await page.request.head(href);
    res.ok() ? ok++ : broken.push({ url: href, status: res.status() });
  } catch (e) {
    broken.push({ url: href, error: e.message });
  }
}

console.log(`✅ 正常链接：${ok}`);
console.log(`❌ 失效链接：`, broken);
await browser.close();
```

## 约束 / 注意事项

1. **完整脚本用原路径跑**——`run.js` 对「已有 `require` + async IIFE」的文件会 **spawn 原路径**（保留 `__dirname`）。依赖 `__dirname` 找 config 的 skill（如 `emc-session-init`）**禁止**先 `cp` 到 `/tmp/` 再跑。
2. **临时探针脚本**可写 `/tmp/playwright-test-*.js`；半成品（无 require）仍走 wrap。
3. **默认 `headless: false`**——便于观察和调试；只有用户明确说"后台跑"才用 `headless: true`。
4. **测 localhost 必须先探测服务**——避免硬编码端口写错。
5. **URL 参数化**——脚本顶部留 `TARGET_URL` 常量，方便复用与切换。
6. **`waitForURL` 慎用整串正则**——若当前 URL 的 **query**（如 `redirect_uri=`）已含目标域名子串，`waitForURL(/work-xxx/)` 会在仍停在旧页时**假通过**。应判 `url.hostname` / `url.pathname`。
7. **不要无限等待**——使用 `waitForSelector` / `waitForURL` / `waitForLoadState('networkidle')`，避免固定 `setTimeout`。
8. **关键步骤要包 `try/catch`**——异常要打印出来，便于排查。
9. **透传参数**：`node run.js ./path/to/script.js -- --flag value`（`--` 后交给脚本）。

## 故障排查

| 现象 | 解决 |
| --- | --- |
| 找不到 playwright 模块 | `cd $SKILL_DIR && npm install` |
| 浏览器装不上 | `cd $SKILL_DIR && npx playwright install chromium` |
| 元素找不到 | 在操作前加 `await page.waitForSelector(...)` |
| `__dirname` / config 路径错 | 不要 `cp` 到 `/tmp`；用 `node run.js ../other-skill/scripts/x.js`（spawn 原路径） |
| `waitForURL` 假通过 | 判 hostname/pathname，别用会命中 query 的宽松正则 |
| 进不去后台 / 被踢回 passport / 无 session | **调 `emc-session-init`**（勿手写 SSO；勿读 secrets） |
| 浏览器不开 | 检查 `headless: false`；SSH 远程环境需要 X 转发 |
| 想让动作慢一点 | 启动参数加 `slowMo: 100`（毫秒） |