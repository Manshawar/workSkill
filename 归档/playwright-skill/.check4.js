// 验证附件页重构
const { chromium } = require('playwright');

const URL = 'http://localhost:5173/appendix';
const SHOT_DIR = '/Volumes/other/toolbox/knowledge/workShare/img/chapter-02';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

  // dark
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => localStorage.setItem('vitepress-theme-appearance', 'dark')).catch(() => {});
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 1. 检查 FileSourceViewer 挂载（找 [class*="box"]）
  const viewerBoxes = await page.locator('[class*="layout"], [class*="tree"]').count();
  console.log('切换器挂载痕迹:', viewerBoxes);

  // 2. 列出所有 H2/H3
  const headings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h2, h3')).map(h =>
      `${h.tagName}: ${h.textContent.trim()}`
    );
  });
  console.log('\n标题列表:');
  headings.forEach(h => console.log('  ', h));

  // 3. 截图
  await page.screenshot({ path: `${SHOT_DIR}/_refactor3-top.png`, fullPage: false });
  console.log('\n📸 _refactor3-top.png');

  // 4. 滚动到第二章（Skill 源文件）
  const skillTitle = await page.getByText('二、Skill 源文件').first();
  await skillTitle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/_refactor3-ch2.png`, fullPage: false });
  console.log('📸 _refactor3-ch2.png');

  // 5. 在第二章尝试点击第 2 个文件（run.js）
  const fileButtons = page.locator('[class*="item"]').filter({ hasText: 'run.js' });
  const count = await fileButtons.count();
  console.log('run.js 按钮数:', count);
  if (count > 0) {
    await fileButtons.first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOT_DIR}/_refactor3-ch2-runjs.png`, fullPage: false });
    console.log('📸 _refactor3-ch2-runjs.png');
  }

  // 6. 滚到第三章（Prompt 源文件）
  const promptTitle = await page.getByText('三、Prompt 源文件').first();
  await promptTitle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/_refactor3-ch3.png`, fullPage: false });
  console.log('📸 _refactor3-ch3.png');

  if (errors.length) {
    console.log('\n错误:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('\n无错误');
  }

  await browser.close();
})();
