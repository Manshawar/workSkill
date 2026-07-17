const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { out[key] = true; } else { out[key] = next; i++; }
  }
  return out;
}

const SKILL_DIR = process.env.EMC_SKILL_DIR
  ? path.resolve(process.env.EMC_SKILL_DIR)
  : path.resolve(__dirname, '..');

function loadJson(candidates, label) {
  for (const p of candidates.filter(Boolean)) {
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      const clean = {};
      for (const k of Object.keys(raw)) { if (!k.startsWith('_')) clean[k] = raw[k]; }
      console.log(`📄 load ${label}: ${path.basename(p)}`);
      return clean;
    }
  }
  return null;
}

function loadConfigFile(cliConfigPath) {
  const cfg = loadJson(
    [cliConfigPath, path.join(SKILL_DIR, 'config.local.json'), path.join(SKILL_DIR, 'config.example.json')],
    'config',
  );
  if (!cfg) {
    console.log('📄 no config file, CLI / env only');
    return {};
  }
  return cfg;
}

function loadUiMap() {
  const ui = loadJson([path.join(SKILL_DIR, 'ui.local.json')], 'ui');
  if (!ui) {
    console.error('❌ missing ui.local.json (gitignored). Create it locally — see SKILL.md UI key table. Do not commit or paste to chat.');
    process.exit(2);
  }
  const required = ['tabAccount', 'phAccount', 'phVerify', 'orgPrompt', 'btnSubmit', 'btnNext', 'btnBackend'];
  for (const k of required) {
    if (!ui[k] || ui[k] === '') {
      console.error(`❌ ui.local.json missing key: ${k}`);
      process.exit(2);
    }
  }
  return ui;
}

const args = parseArgs(process.argv.slice(2));
const fileConfig = loadConfigFile(args.config);
const UI = loadUiMap();

function pick(cliKey, envKey, fileKey, { required = false, label = '' } = {}) {
  if (args[cliKey] !== undefined && args[cliKey] !== true) return args[cliKey];
  if (process.env[envKey] && process.env[envKey] !== '') return process.env[envKey];
  if (fileKey && fileConfig[fileKey] && fileConfig[fileKey] !== '') return fileConfig[fileKey];
  if (required) {
    console.error(`❌ missing required: ${label}`);
    console.error(`   set "${fileKey}" in config.local.json`);
    console.error(`   or env ${envKey}`);
    console.error(`   or CLI --${cliKey}`);
    process.exit(2);
  }
  return undefined;
}

const CONFIG = {
  entryUrl: pick('entry-url', 'EMC_ENTRY_URL', 'entryUrl'),
  account: pick('account', 'EMC_ACCOUNT', 'account', { required: true, label: 'account' }),
  verifyToken: pick('verify-token', 'EMC_VERIFY_TOKEN', 'verifyToken', { required: true, label: 'verifyToken' }),
  accessKey: pick('access-key', 'EMC_ACCESS_KEY', 'accessKey', { required: true, label: 'accessKey' }),
  org: pick('org', 'EMC_ORG', 'org'),
  role: pick('role', 'EMC_ROLE', 'role'),
  session: pick('session-out', 'EMC_SESSION_FILE', 'session'),
};

(async () => {
  console.log('────────────────────────────────────');
  console.log('📋 EMC Session Init:');
  console.log('  entryUrl :', CONFIG.entryUrl);
  console.log('  account  :', String(CONFIG.account).replace(/.(?=.{4})/g, '*'));
  console.log('  verify   :', '*'.repeat(String(CONFIG.verifyToken).length));
  console.log('  accessKey:', '*'.repeat(String(CONFIG.accessKey).length));
  console.log('  org      :', CONFIG.org);
  console.log('  role     :', CONFIG.role);
  console.log('  session  :', CONFIG.session);
  console.log('────────────────────────────────────');

  const browser = await chromium.launch({ headless: true, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('  [browser:error]', msg.text().slice(0, 200)); });
  page.on('pageerror', (err) => console.log('  [pageerror]', err.message));

  const log = (s) => console.log(`\n▶ ${s}`);
  const step = async (name, fn) => {
    log(name);
    try {
      await fn();
      console.log(`  ✅ ${name} ok`);
    } catch (e) {
      console.log(`  ❌ ${name} fail: ${e.message.split('\n')[0]}`);
      await page.screenshot({ path: `/tmp/init-fail-${Date.now()}.png` });
      throw e;
    }
  };

  try {
    await step('1 open entry + switch tab', async () => {
      await page.goto(CONFIG.entryUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.locator(`text=${UI.tabAccount}`).first().click();
      await page.waitForSelector(`input[placeholder="${UI.phAccount}"]`, { timeout: 10000 });
    });

    await step('2a fill account + next', async () => {
      await page.locator(`input[placeholder="${UI.phAccount}"]`).fill(CONFIG.account);
      await page.locator(`button:has-text("${UI.btnNext}")`).first().click();
      await page.waitForSelector(`input[placeholder="${UI.phVerify}"]`, { timeout: 10000 });
    });

    await step('2b fill verifyToken + next', async () => {
      await page.locator(`input[placeholder="${UI.phVerify}"]`).fill(CONFIG.verifyToken);
      await page.locator(`button:has-text("${UI.btnNext}")`).first().click();
      await page.waitForSelector(`text=${UI.orgPrompt}`, { timeout: 10000 });
    });

    await step(`3a pick org «${CONFIG.org}»`, async () => {
      await page.locator('dd', { hasText: CONFIG.org }).first().click();
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    });

    await step('3b fill accessKey + submit', async () => {
      await page.locator('input[type="password"]').fill(CONFIG.accessKey);
      await page.locator(`button:has-text("${UI.btnSubmit}")`).first().click();
      // MUST match hostname — entryUrl query has redirect_uri=...work-betacloud...
      // so /work-betacloud/ on full URL string is a FALSE PASS while still on /passport/
      await page.waitForURL(
        (url) => url.hostname.includes('work-betacloud') && !/passport/i.test(url.pathname),
        { timeout: 15000 },
      );
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
      const after = page.url();
      console.log('  url after submit:', after);
      if (/passport/i.test(after)) {
        throw new Error(`SSO submit failed, still on passport: ${after}`);
      }
    });

    let eappsPage = page;
    await step('4 open backend tab', async () => {
      const popupPromise = context.waitForEvent('page', { timeout: 10000 });
      await page.locator(`text=${UI.btnBackend}`).first().click();
      eappsPage = await popupPromise;
      await eappsPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
      await eappsPage.waitForTimeout(2000);
      console.log('  popup url:', eappsPage.url());
    });

    await step(`5 pick role «${CONFIG.role}»`, async () => {
      const roles = await eappsPage.locator(`text=${CONFIG.role}`).all();
      if (roles.length === 0) throw new Error(`role not found: ${CONFIG.role}`);
      let clicked = false;
      for (const r of roles) { if (await r.isVisible()) { await r.click(); clicked = true; break; } }
      if (!clicked) throw new Error(`role not visible: ${CONFIG.role}`);
      await eappsPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
      await eappsPage.waitForTimeout(2000);
    });

    await step('6 save storageState', async () => {
      await eappsPage.waitForTimeout(2000);
      await context.storageState({ path: CONFIG.session });
      console.log(`  session saved: ${CONFIG.session}`);
    });

    log('done');
    console.log('────────────────────────────────────');
    console.log('main url   :', page.url());
    console.log('backend url:', eappsPage.url());
    console.log('session    :', CONFIG.session);
    console.log('reuse      : load storageState in other scripts');
    console.log('────────────────────────────────────');
  } catch (e) {
    console.error('\n❌ aborted:', e.message.split('\n')[0]);
    console.error('current url:', page.url());
    console.error('see references/troubleshooting.md');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
