// 检查附件页内容
const { chromium } = require('playwright');

const URL = 'http://127.0.0.1:5173/appendix';
const SHOT_DIR = '/Volumes/other/toolbox/knowledge/workShare/img/chapter-02';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // 监听 console 错误
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

  // dark 模式
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => localStorage.setItem('vitepress-theme-appearance', 'dark')).catch(() => {});
  await page.goto(URL, { waitUntil: 'networkidle' });

  // 抓页面所有代码块数量
  const codeBlockCount = await page.evaluate(() => document.querySelectorAll('pre code, pre').length);
  console.log('代码块数量:', codeBlockCount);

  // 抓页面 H2 / H3 标题
  const headings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h2, h3')).map(h => `${h.tagName}: ${h.textContent.trim()}`);
  });
  console.log('标题:', headings);

  if (errors.length) {
    console.log('\n错误:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('\n无错误');
  }

  // 截图 dark 模式顶部
  await page.screenshot({ path: `${SHOT_DIR}/_check-appendix-dark.png`, fullPage: false });

  // 滚动到底部截图
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/_check-appendix-dark-bottom.png`, fullPage: false });

  await browser.close();
})();