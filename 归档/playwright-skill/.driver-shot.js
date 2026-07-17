// 截图 driver（不写明文凭据到文件）
// 凭据走环境变量，跑前必须 export EMC_PHONE / EMC_CODE / EMC_PASSWORD
// 截图输出到 /Volumes/other/toolbox/knowledge/workShare/img/chapter-02/

const { chromium } = require('playwright');
const fs = require('fs');

const SHOT_DIR = '/Volumes/other/toolbox/knowledge/workShare/img/chapter-02';
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

// 凭据仅从环境变量读，缺失直接退出（避免静默用错凭据）
const PHONE = process.env.EMC_PHONE;
const CODE = process.env.EMC_CODE;
const PASSWORD = process.env.EMC_PASSWORD;
if (!PHONE || !CODE || !PASSWORD) {
  console.error('❌ 缺少环境变量 EMC_PHONE / EMC_CODE / EMC_PASSWORD');
  console.error('   用法：export EMC_PHONE=xx EMC_CODE=xx EMC_PASSWORD=xx && node driver.js');
  process.exit(2);
}

const LOGIN_URL = 'https://user-betacloud.e.lanxin.cn/user/passport/pc/login?redirect_uri=https%3A%2F%2Fwork-betacloud.e.lanxin.cn%2Fwork%2Femc%2Fapp-center%2Fapp-manage-list%2F16277504%2F2621440%2Fdetail';
const ORG_TEXT = '生态应用测试组织';
const ROLE_TEXT = '版块管理员';
const SESSION_FILE = '/tmp/emc-session.json';
const APP_DETAIL_URL = 'https://work-betacloud.e.lanxin.cn/work/emc/app-center/app-manage-list/16277504/2621440/detail';

(async () => {
  const browser = await chromium.launch({ headless: true, slowMo: 80 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  let active = page;
  const shot = (name) => active.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false })
    .then(() => console.log(`  📸 ${name}.png`));

  try {
    console.log('\n▶ 登录流程（带截图）');

    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await shot('01-login-page');

    await page.locator('text=账号登录').first().click();
    await page.waitForSelector('input[placeholder="请输入手机号码"]', { timeout: 10000 });
    await shot('02-switch-to-account');

    await page.locator('input[placeholder="请输入手机号码"]').fill(PHONE);
    await shot('03-phone-filled');
    await page.locator('button:has-text("下一步")').first().click();
    await page.waitForSelector('input[placeholder="请输入短信验证码"]', { timeout: 10000 });
    await shot('04-code-input-ready');

    await page.locator('input[placeholder="请输入短信验证码"]').fill(CODE);
    await shot('05-code-filled');
    await page.locator('button:has-text("下一步")').first().click();
    await page.waitForSelector('text=请选择需要登录的组织', { timeout: 10000 });
    await shot('06-org-list');

    await page.locator('dd', { hasText: ORG_TEXT }).first().click();
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await shot('07-password-input-ready');

    await page.locator('input[type="password"]').fill(PASSWORD);
    await shot('08-password-filled');
    await page.locator('button:has-text("登录")').first().click();
    await page.waitForURL(/work-betacloud/, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await shot('09-app-detail-page');

    const popupPromise = context.waitForEvent('page', { timeout: 10000 });
    await page.locator('text=前往后台').first().click();
    const eappsPage = await popupPromise;
    await eappsPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await eappsPage.waitForTimeout(2000);
    active = eappsPage;
    await shot('10-switch-identity');

    const roles = await eappsPage.locator(`text=${ROLE_TEXT}`).all();
    for (const r of roles) {
      if (await r.isVisible()) { await r.click(); break; }
    }
    await eappsPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await eappsPage.waitForTimeout(2000);
    await shot('11-admin-home');

    await eappsPage.waitForTimeout(2000);
    await context.storageState({ path: SESSION_FILE });
    console.log(`  📄 Session 已保存：${SESSION_FILE}`);

    // ─── 复用 session 进批量新增 ───
    console.log('\n▶ 批量新增流程（带截图，复用 session）');

    const fsLib = require('fs');
    if (!fsLib.existsSync(SESSION_FILE)) throw new Error('session 不存在');

    const appPage = await context.newPage();
    appPage.on('console', (m) => { if (m.type() === 'error') console.log('  [browser:error]', m.text().slice(0, 200)); });
    active = appPage;

    await appPage.goto(APP_DETAIL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await shot('20-batch-step1-app-detail');

    const popup2 = context.waitForEvent('page', { timeout: 10000 });
    await appPage.locator('text=前往后台').first().click();
    const eapps2 = await popup2;
    await eapps2.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await eapps2.waitForTimeout(2000);
    active = eapps2;

    if (eapps2.url().includes('switch-identity')) {
      const role = eapps2.locator(`text=${ROLE_TEXT}`).first();
      await role.waitFor({ timeout: 10000 });
      await role.click();
      await eapps2.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await eapps2.waitForTimeout(2000);
    }
    await shot('21-batch-step2-popup');

    const kbMenu = eapps2.locator('li').filter({ hasText: '知识库管理' }).first();
    await kbMenu.waitFor({ timeout: 10000 });
    await kbMenu.click();
    await eapps2.waitForURL(/topic-list|knowledge/, { timeout: 10000 }).catch(() => {});
    await eapps2.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await eapps2.waitForTimeout(2000);
    await shot('22-batch-step4-topic-list');

    // 抓现有名字做去重
    const existingNames = new Set();
    const cells = await eapps2.locator('table td:nth-child(2), .el-table__row td:nth-child(2)').all();
    for (const c of cells) {
      const t = (await c.innerText().catch(() => '')).trim();
      if (t) existingNames.add(t);
    }
    console.log(`  📋 当前列表中已有 ${existingNames.size} 个主题（用于去重）`);

    // 造 3 条新主题（少量就够演示）
    const VOCAB = {
      category: ['性能', 'UI', '功能', '边界', '回归'],
      type:    ['测试', '验证', '压测'],
      suffix:  ['主题', '用例', '场景'],
    };
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const makeName = (i) => {
      const c = pick(VOCAB.category);
      const t = pick(VOCAB.type);
      const s = pick(VOCAB.suffix);
      const rand = Math.random().toString(36).slice(2, 6);
      const n = String(i + 1).padStart(2, '0');
      return `${c}${t}-${s}-${rand}${n}`;
    };
    const COUNT = 3;
    const TOPICS = Array.from({ length: COUNT }, (_, i) => makeName(i));
    console.log('  📋 本次将创建：');
    TOPICS.forEach((n, i) => console.log(`    ${i + 1}. ${n}`));

    for (let i = 0; i < TOPICS.length; i++) {
      const name = TOPICS[i];
      if (existingNames.has(name)) {
        console.log(`  ⏭  跳过「${name}」（已存在）`);
        continue;
      }
      console.log(`  ▶ 新增「${name}」（${i + 1}/${TOPICS.length}）`);

      const newBtn = eapps2.locator('button.el-button--primary', { hasText: '新增主题' }).first();
      await newBtn.waitFor({ timeout: 10000 });
      await newBtn.click();
      await eapps2.waitForSelector('textarea[placeholder="请输入主题描述"]', { timeout: 10000 });
      await shot(`23-batch-step5-${i + 1}-dialog`);

      await eapps2.locator('input[placeholder="请输入主题名称"]').fill(name);
      await eapps2.locator('input[placeholder="点击选择适用范围"]').click({ force: true });
      await eapps2.waitForTimeout(2000);
      const scopeDialog = eapps2.locator('.el-dialog').last();
      await scopeDialog.getByRole('treeitem', { name: '测试' }).locator('label.el-checkbox').click({ force: true });
      await eapps2.waitForTimeout(300);
      await scopeDialog.getByRole('treeitem', { name: '研发' }).locator('label.el-checkbox').click({ force: true });
      await eapps2.waitForTimeout(300);
      await scopeDialog.locator('button:has-text("确 定")').click();
      await eapps2.waitForTimeout(1500);
      await eapps2.locator('textarea[placeholder="请输入主题描述"]').fill(`由自动化脚本随机生成（演示截图）。`);
      await shot(`24-batch-step5-${i + 1}-filled`);

      const confirmBtn = eapps2.locator('.el-dialog').first().locator('button:has-text("确定")').last();
      await confirmBtn.click();
      await eapps2.waitForSelector('textarea[placeholder="请输入主题描述"]', { state: 'hidden', timeout: 15000 });
      await eapps2.waitForTimeout(1500);
      console.log(`    ✅ 创建成功`);
    }

    await eapps2.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await eapps2.waitForTimeout(2000);
    await shot('25-batch-final-list');

    console.log('\n▶ 截图流程完成');
  } catch (e) {
    console.error('\n❌ 流程中断：', e.message.split('\n')[0]);
    await page.screenshot({ path: `${SHOT_DIR}/99-fail.png` });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();