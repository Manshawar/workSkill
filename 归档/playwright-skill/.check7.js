// 验证：第二章顶部出现 AiFlow，附件页不再有 AiFlow
const { chromium } = require('playwright');

const SHOT_DIR = '/Volumes/other/toolbox/knowledge/workShare/img/chapter-02';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();

  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => localStorage.setItem('vitepress-theme-appearance', 'dark')).catch(()=>{});

  // ─── 第二章 ───
  await page.goto('http://localhost:5173/02-skill-demo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const ch2Headings = await page.locator('h1, h2').allTextContents();
  console.log('第二章 H1/H2:');
  ch2Headings.forEach(h => console.log(' ', h));

  // 看 AiFlow 是否在 02 页面挂载
  const nodes = await page.locator('[class*="nodeActive"], [class*="itemActive"]').count();
  console.log('第二章高亮节点数（AiFlow 默认高亮 1 个）:', nodes);

  // 截图顶部
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT_DIR + '/_ch2-new-top.png', fullPage: false });
  console.log('📸 _ch2-new-top.png');

  // 点 AiFlow 第 3 节点（AI 决策）
  const allBox = await page.locator('[class*="node"]').all();
  console.log('第二章节点总数:', allBox.length);
  if (allBox.length >= 3) {
    await allBox[2].click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT_DIR + '/_ch2-aiflow-node3.png', fullPage: false });
    console.log('📸 _ch2-aiflow-node3.png');
  }

  // ─── 附件页 ───
  await page.goto('http://localhost:5173/appendix', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const appHeadings = await page.locator('h1, h2').allTextContents();
  console.log('\n附件页 H1/H2:');
  appHeadings.forEach(h => console.log(' ', h));

  // 附件页应只有 2 个 FileSourceViewer，无 AiFlow 的 5 节点
  const treeCount = await page.locator('[class*="tree"]').count();
  const aiFlowNodes = await page.locator('[class*="node"]').count();
  console.log('附件页 切换器数:', treeCount, '(期望 2)');
  console.log('附件页 5 节点数（AiFlow）:', aiFlowNodes, '(期望 0)');

  await page.screenshot({ path: SHOT_DIR + '/_appendix-new-top.png', fullPage: false });
  console.log('📸 _appendix-new-top.png');

  // ─── 全局错误 ───
  console.log('\n错误:', errs.length === 0 ? '无' : errs);

  await browser.close();
})();
