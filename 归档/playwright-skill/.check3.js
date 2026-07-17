// 验证附件页重构后的效果
const { chromium } = require('playwright');

const URL = 'http://127.0.0.1:5173/appendix';
const SHOT_DIR = '/Volumes/other/toolbox/knowledge/workShare/img/chapter-02';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

  // dark
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => localStorage.setItem('vitepress-theme-appearance', 'dark')).catch(() => {});
  await page.goto(URL, { waitUntil: 'networkidle' });

  // 1. 组件存在
  const hasFlow = await page.locator('.appendix-flow, [class*="AppendixFlow"], [class*="box"]').count();
  console.log('组件挂载元素数:', hasFlow);

  // 2. 代码块总数
  const codeBlocks = await page.evaluate(() => document.querySelectorAll('pre code, pre').length);
  console.log('代码块总数:', codeBlocks);

  // 3. H2 / H3 标题
  const headings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h2, h3')).map(h =>
      `${h.tagName}: ${h.textContent.trim()}`
    );
  });
  console.log('标题列表:');
  headings.forEach(h => console.log('  ', h));

  // 4. 组件顶部截图
  await page.screenshot({ path: `${SHOT_DIR}/_appendix-flow-top.png`, fullPage: false });
  console.log('📸 _appendix-flow-top.png');

  // 5. 滚到组件位置截图
  await page.evaluate(() => window.scrollTo(0, 100));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOT_DIR}/_appendix-flow-near-top.png`, fullPage: false });
  console.log('📸 _appendix-flow-near-top.png');

  // 6. 点击第 3 节点（解析）截图证明可交互
  const nodes = await page.locator('[class*="node"]').all();
  console.log('节点数:', nodes.length);
  if (nodes.length >= 3) {
    await nodes[2].click();
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.screenshot({ path: `${SHOT_DIR}/_appendix-flow-node3.png`, fullPage: false });
    console.log('📸 _appendix-flow-node3.png');
  }

  if (errors.length) {
    console.log('\n错误:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('\n无错误');
  }

  await browser.close();
})();
