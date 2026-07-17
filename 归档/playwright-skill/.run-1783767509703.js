// /tmp/emc-verify-session.js — 最小 session 有效性探针
const { chromium } = require('playwright');
const APP_DETAIL_URL = 'https://work-betacloud.e.lanxin.cn/work/emc/app-center/app-manage-list/16277504/2621440/detail';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: '/tmp/emc-session.json',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(APP_DETAIL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const kicked = /passport\/pc\/login|\/login/i.test(page.url());
    console.log(kicked ? '❌ session 失效，需重跑 emc-auto-login' : '✅ session 有效');
    console.log('当前 URL：', page.url());
    process.exit(kicked ? 1 : 0);
  } catch (e) {
    console.log('⚠️ 探针异常：', e.message.split('\n')[0]);
    console.log('当前 URL：', page.url());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
