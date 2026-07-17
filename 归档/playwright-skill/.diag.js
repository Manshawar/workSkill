// 抓 console error
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') errs.push('console.error: ' + m.text());
    else if (m.type() === 'warning') errs.push('console.warn: ' + m.text());
  });
  await page.goto('http://127.0.0.1:5173/appendix', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('错误条数:', errs.length);
  errs.forEach(e => console.log(' -', e));
  await browser.close();
})();
