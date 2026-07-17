// 用 Playwright 抓 dark/light 两模式下 SkillCallFlow 组件的截图
const { chromium } = require('playwright');

const URL = 'http://127.0.0.1:5173/02-skill-demo';
const SHOT_DIR = '/Volumes/other/toolbox/knowledge/workShare/img/chapter-02';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // 1. light 模式
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(URL, { waitUntil: 'networkidle' });
  // 滚动到组件位置
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/_check-light.png`, fullPage: false });
  console.log('📸 _check-light.png');

  // 2. dark 模式（vitepress 通常有切换按钮，先用 localStorage 模拟）
  await page.evaluate(() => {
    localStorage.setItem('vitepress-theme-appearance', 'dark');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/_check-dark.png`, fullPage: false });
  console.log('📸 _check-dark.png');

  // 3. 抓组件的 computed style 看实际生效的 CSS 变量值
  const lightVars = await page.evaluate(() => {
    return {
      bg: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-bg'),
      bgSoft: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-bg-soft'),
      divider: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-divider'),
      text1: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-text-1'),
      text2: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-text-2'),
      text3: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-text-3'),
      brand1: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-brand-1'),
      brandText: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-brand-text'),
    };
  });
  console.log('\n[DARK 模式 CSS 变量]');
  console.log(JSON.stringify(lightVars, null, 2));

  await browser.close();
})();