# 执行规范

> 本文件不是 Playwright API 字典，而是使用本 Skill 编写浏览器自动化脚本时**必须遵守的执行规范**。
> 它规定的是"应该怎么做"和"不能怎么做"，具体 API 用法请查 [Playwright 官方文档](https://playwright.dev/docs/api)。

## 1. 选择器（Selectors）

按优先级选用，越靠前越稳：

| 优先级 | 选择器 | 示例 | 说明 |
| --- | --- | --- | --- |
| 1 | `data-testid` | `page.getByTestId('submit-btn')` | 最稳，不受文案 / 样式变化影响 |
| 2 | `role` | `page.getByRole('button', { name: '提交' })` | 语义化，对无障碍友好 |
| 3 | `text` | `page.getByText('立即登录')` | 适合链接、按钮文案 |
| 4 | `label` | `page.getByLabel('邮箱')` | 表单输入 |
| 5 | CSS / XPath | `page.locator('.btn-primary')` | 兜底，不推荐优先用 |

**禁止**：

- 用 nth-child / nth-of-type 等位置选择器（页面结构一变就失效）
- 写超长 CSS 链（脆弱且难读）

## 2. 等待策略（Wait）

**显式等待 > 隐式等待 > 固定超时**。

| 场景 | 推荐 API |
| --- | --- |
| 等页面加载完 | `await page.waitForLoadState('networkidle')` |
| 等某个元素出现 | `await page.waitForSelector(sel, { state: 'visible' })` |
| 等跳转 | `await page.waitForURL('**/dashboard')` |
| 等接口返回 | `await page.waitForResponse(r => r.url().includes('/api/x'))` |
| 等固定时长 | 仅在以上都不适用时使用 `await page.waitForTimeout(ms)`，并加注释说明原因 |

**禁止**：

- 用 `setTimeout` 做主等待
- 一上来就 `await page.waitForTimeout(3000)`（慢且不稳）

## 3. 错误处理

- 关键步骤必须包 `try / catch`，异常打印 `error.message`（必要时 `error.stack`）。
- 浏览器进程必须 `await browser.close()`，建议用 `try / finally` 兜底。
- 不要 `catch {}` 静默吞错——会让失败原因难追。

## 4. 调试约定

| 项 | 规范 |
| --- | --- |
| 浏览器可见性 | 默认 `headless: false`；只有用户明确要求后台执行才用 `headless: true` |
| 慢动作 | 调试时 `slowMo: 100`（毫秒），便于观察 |
| 截图 | 统一存 `/tmp/playwright-<场景名>.png`，命名清晰 |
| 视频 / 追踪 | 调试复杂场景时 `recordVideo` / `tracing.start()`，但默认不开启 |
| 关键节点日志 | 每个关键步骤 `console.log` 一句，如 `console.log('✅ 已打开首页')` |

## 5. 资源管理

- **脚本位置**：一律写 `/tmp/playwright-test-*.js`，**绝不写到项目目录**或 skill 目录。
- **截图 / 数据位置**：一律写 `/tmp/`，由操作系统清理。
- **浏览器关闭**：每次执行结束必须 `await browser.close()`，否则进程泄漏。
- **临时变量**：URL 等可变量要参数化（脚本顶部 `const TARGET_URL = '...'`），便于复用。

## 6. 反模式（不要这么做）

```javascript
// ❌ 用固定超时代替显式等待
await page.waitForTimeout(3000);
await page.click('button');

// ❌ 硬编码 URL 且不参数化
const url = 'http://localhost:3001/users/123';

// ❌ 把脚本写在项目里
fs.writeFileSync('./test.js', code);   // 会污染用户项目

// ❌ catch 后什么都不做
try { await page.click('button'); } catch (e) {}

// ❌ 不关浏览器
const browser = await chromium.launch();
// ... 没有 await browser.close()

// ❌ 静默吞错
if (!element) { /* 假装没事 */ }

// ❌ 用 nth-child 这种脆弱选择器
page.locator('div > ul > li:nth-child(3) > a');

// ❌ 在循环里用 page.waitForTimeout 累计等待
for (const item of items) {
  await page.waitForTimeout(500);
  await page.click(item);
}
```

## 7. 输出规范（给用户）

脚本结束后，给用户的汇报应包含：

1. **行为结论**：浏览器做了什么、是否符合预期
2. **关键日志**：从 `console.log` 中挑出关键节点
3. **产物路径**：截图 / 数据写到了哪个文件（如 `/tmp/screenshot.png`）

格式参考：

```
✅ 已完成首页响应式截图
   - desktop (1440x900) → /tmp/desktop.png
   - tablet  (768x1024) → /tmp/tablet.png
   - mobile  (375x667)  → /tmp/mobile.png
```

## 8. 何时停止使用本 Skill

以下场景**不要**用本 Skill，应改用其它工具：

- 纯 HTTP 接口测试 → 直接 `curl` 或接口测试脚本
- 大规模爬虫 → 用专门爬虫框架
- 移动原生 App → 用 Appium
- 单测 / 集成测 → 用项目自带的测试框架（vitest / jest / pytest 等）

写脚本前先判断是否落在"模拟真实用户在浏览器里点一点"的范围内。