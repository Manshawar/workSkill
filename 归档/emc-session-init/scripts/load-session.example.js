// emc-session-init/scripts/load-session.example.js
// Load saved storageState; skip SSO; open backend.
// Demo only — not the main init flow.
//
// Usage:
//   cp .claude/skills/emc-session-init/scripts/load-session.example.js /tmp/emc-load.js
//   cd .claude/skills/playwright-skill && node run.js /tmp/emc-load.js TARGET_URL

const { chromium } = require('playwright');

const SESSION_FILE = process.env.EMC_SESSION_FILE || '/tmp/emc-session.json';
const TARGET_URL = process.argv[2] || process.env.EMC_TARGET_URL || '';

(async () => {
  if (!TARGET_URL) {
    console.error('usage: node run.js /tmp/emc-load.js TARGET_BACKEND_URL');
    console.error('   or: EMC_TARGET_URL=https://... node run.js /tmp/emc-load.js');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  const kicked = /passport/i.test(page.url());

  console.log('────────────────────────────────────');
  console.log('Session :', SESSION_FILE);
  console.log('Target  :', TARGET_URL);
  console.log('Current :', page.url());
  console.log(kicked ? '❌ session dead — re-run emc-session-init' : '✅ session ok');
  console.log('────────────────────────────────────');

  await browser.close();
})();
