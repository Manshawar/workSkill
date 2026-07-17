// 验证 srcExclude 效果
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. 访问 /prompt/auto-new-topic
  await page.goto('http://localhost:5173/prompt/auto-new-topic', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const title1 = await page.title();
  const h1 = await page.locator('h1, h2').allTextContents();
  const hasViewer = (await page.locator('[class*="layout"]').count()) > 0;
  console.log('/prompt/auto-new-topic →');
  console.log('  title:', title1 || '(空)');
  console.log('  h1/h2:', h1.join(' | '));
  console.log('  切源码器:', hasViewer ? '是（说明 vitepress 把整页打过去了——错了）' : '否（说明渲染的是 fallback）');

  // 2. 访问 /appendix
  await page.goto('http://localhost:5173/appendix', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const h1App = await page.locator('h1, h2').allTextContents();
  const viewerCount = await page.locator('[class*="tree"]').count();
  console.log('\n/appendix →');
  console.log('  h1/h2:', h1App.join(' | '));
  console.log('  切源码器数:', viewerCount);

  // 3. 访问 /01-why-skill 主章节
  await page.goto('http://localhost:5173/01-why-skill', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const mainH = await page.locator('h1, h2').allTextContents();
  console.log('\n/01-why-skill →');
  console.log('  h1/h2 前 3:', mainH.slice(0, 3).join(' | '));

  await browser.close();
})();
