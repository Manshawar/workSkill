// 看 /appendix sidebar 实际链接
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => localStorage.setItem('vitepress-theme-appearance', 'dark')).catch(()=>{});
  await page.goto('http://localhost:5173/appendix', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const sidebarLinks = await page.locator('.VPSidebar a, aside a').allTextContents();
  console.log('sidebar 文本:', sidebarLinks);
  const sidebarHrefs = await page.locator('.VPSidebar a, aside a').evaluateAll(els => els.map(e => e.getAttribute('href')));
  console.log('sidebar href:', sidebarHrefs);
  await browser.close();
})();
