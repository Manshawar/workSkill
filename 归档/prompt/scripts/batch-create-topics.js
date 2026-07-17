// prompt/scripts/batch-create-topics.js
// 复用 session → 进入知识库管理 → 批量新增主题
// 依赖：emc-session-init（scripts/init.js）已跑过，SESSION_FILE 存在
//
// 新增主题对话框字段（已通过探针确认）：
//   - 主题名称：input[placeholder="请输入主题名称"]（限 20 字）
//   - 适用范围：input[placeholder="点击选择适用范围"]（可选）
//   - 排序    ：input[type="number"][placeholder="数字越大排序越靠后"]
//   - 主题描述：textarea[placeholder="请输入主题描述"]
//   - 按钮    ：取消 / 确定

const { chromium } = require('playwright');

const APP_DETAIL_URL = 'https://work-betacloud.e.lanxin.cn/work/emc/app-center/app-manage-list/16277504/2621440/detail';
const ROLE_TEXT = '版块管理员';
const SESSION_FILE = '/tmp/emc-session.json';

// ─── 词汇库：每次跑从里随机抽词组合 ───
// 三组词 + 4 位随机串 + 序号，组合出独一无二的主题名（避开去重）
const VOCAB = {
  category: ['性能', 'UI', '功能', '边界', '回归', '压力', '安全', '兼容', '数据', '接口'],
  type:    ['测试', '验证', '压测', '评估', '演练', '冒烟', '巡检'],
  suffix:  ['主题', '用例', '场景', '用例集', '测试集'],
};

// ─── 随机组合生成器 ───
// 命名格式：`{类别}{类型}-{后缀}-{rand}{序号}`
// 示例：`性能压测-主题-k7f201`、`UI验证-用例集-a3p102`
function makeRandomTopic(i) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const c = pick(VOCAB.category);
  const t = pick(VOCAB.type);
  const s = pick(VOCAB.suffix);
  const rand = Math.random().toString(36).slice(2, 6); // 4 位 base36 随机串
  const n = String(i + 1).padStart(2, '0');
  return {
    name: `${c}${t}-${s}-${rand}${n}`,
    desc: `由自动化脚本随机生成（${c} / ${t}）。`,
  };
}

// ─── 测试数据：运行时随机生成 ───
// 想跑几条改 COUNT；想换词改 VOCAB；想固定数据改成读文件 / 命令行参数
const COUNT = 10;
const TOPICS = Array.from({ length: COUNT }, (_, i) => makeRandomTopic(i));

// 启动时先把要建的名字打出来（便于回溯）
console.log(`📋 本次将创建 ${TOPICS.length} 条主题（随机生成）：`);
TOPICS.forEach((t, i) => console.log(`  ${i + 1}. ${t.name}`));

(async () => {
  const fs = require('fs');
  if (!fs.existsSync(SESSION_FILE)) {
    console.error(`❌ 找不到 ${SESSION_FILE}，请先跑 emc-session-init（scripts/init.js）`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true, slowMo: 60 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    storageState: SESSION_FILE, // 复用 session，跳过 SSO
  });
  const appPage = await context.newPage();

  appPage.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [browser:error]', msg.text().slice(0, 200));
  });
  appPage.on('pageerror', (err) => console.log('  [pageerror]', err.message));

  const log = (s) => console.log(`\n▶ ${s}`);
  const results = { success: 0, failed: [], skipped: 0 };

  try {
    // ─── 步骤 1：打开应用详情（验证 session 有效） ───
    log('步骤 1：打开应用详情（验证 session）');
    await appPage.goto(APP_DETAIL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    if (appPage.url().includes('passport/pc/login')) {
      throw new Error('session 已失效，请重新跑 emc-session-init');
    }
    console.log('  ✅ session 有效');

    // ─── 步骤 2：点「前往后台」 → 等新标签页 ───
    log('步骤 2：点前往后台 → 等新标签页');
    const popupPromise = context.waitForEvent('page', { timeout: 10000 });
    await appPage.locator('text=前往后台').first().click();
    let eappsPage = await popupPromise;
    await eappsPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await eappsPage.waitForTimeout(2000);

    // ─── 步骤 3：选版块管理员 ───
    log('步骤 3：选版块管理员身份');
    // 先看 URL，如果已经在 home-index 说明已选过
    if (!eappsPage.url().includes('switch-identity')) {
      console.log('  ⚠️ URL 不在 switch-identity，跳过选身份');
      console.log('  当前 URL：', eappsPage.url());
    } else {
      const role = eappsPage.locator(`text=${ROLE_TEXT}`).first();
      await role.waitFor({ timeout: 10000 });
      await role.click();
      await eappsPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await eappsPage.waitForTimeout(2000);
    }

    // ─── 步骤 4：进知识库管理 ───
    log('步骤 4：进知识库管理');
    // 等菜单稳定
    await eappsPage.waitForSelector('li', { timeout: 10000 });
    const kbMenu = eappsPage.locator('li').filter({ hasText: '知识库管理' }).first();
    await kbMenu.waitFor({ timeout: 10000 });
    await kbMenu.click();
    await eappsPage.waitForURL(/topic-list|knowledge/, { timeout: 10000 }).catch(() => {});
    await eappsPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await eappsPage.waitForTimeout(2000);
    console.log('  当前 URL：', eappsPage.url());

    // ─── 步骤 5：循环新增主题 ───
    // 先等列表稳定（看到一行主题数据）
    await eappsPage.locator('text=/详情 编辑/').first().waitFor({ timeout: 10000 }).catch(() => {});
    await eappsPage.waitForTimeout(1000);

    // ─── 去重：抓取当前所有主题名称 ───
    const existingNames = new Set();
    const existingCells = await eappsPage.locator('table td:nth-child(2), .el-table__row td:nth-child(2)').all();
    for (const cell of existingCells) {
      const t = (await cell.innerText().catch(() => '')).trim();
      if (t) existingNames.add(t);
    }
    // 兜底：扫整个 body 找含「批量测试主题」的文本
    const bodyText = await eappsPage.locator('body').innerText();
    TOPICS.forEach((tp) => {
      if (bodyText.includes(tp.name)) existingNames.add(tp.name);
    });
    console.log(`  📋 当前列表中已有 ${existingNames.size} 个主题（用于去重）`);

    for (let i = 0; i < TOPICS.length; i++) {
      const t = TOPICS[i];
      // 跳过已存在
      if (existingNames.has(t.name)) {
        log(`步骤 5.${i + 1}：跳过「${t.name}」（已存在）`);
        results.skipped = (results.skipped || 0) + 1;
        continue;
      }
      log(`步骤 5.${i + 1}：新增主题「${t.name}」（${i + 1}/${TOPICS.length}）`);

      try {
        // 5.1 点「新增主题」按钮（精确：primary button + 含"新增主题"）
        const newBtn = eappsPage.locator('button.el-button--primary', { hasText: '新增主题' }).first();
        await newBtn.waitFor({ timeout: 10000 });
        await newBtn.click();

        // 5.2 等对话框出现（看「主题描述」textarea）
        await eappsPage.waitForSelector('textarea[placeholder="请输入主题描述"]', { timeout: 10000 });

        // 5.3 填主题名称
        const nameInput = eappsPage.locator('input[placeholder="请输入主题名称"]');
        await nameInput.waitFor({ timeout: 5000 });
        await nameInput.fill(t.name);

        // 5.4 选「适用范围」（必填）— 勾选"测试""研发"两个分支
        await eappsPage.locator('input[placeholder="点击选择适用范围"]').click({ force: true });
        await eappsPage.waitForTimeout(2000);
        const scopeDialog = eappsPage.locator('.el-dialog').last();
        // 用 getByRole 精确选 treeitem，避开 hasText 嵌套冲突
        await scopeDialog.getByRole('treeitem', { name: '测试' }).locator('label.el-checkbox').click({ force: true });
        await eappsPage.waitForTimeout(500);
        await scopeDialog.getByRole('treeitem', { name: '研发' }).locator('label.el-checkbox').click({ force: true });
        await eappsPage.waitForTimeout(500);
        await scopeDialog.locator('button:has-text("确 定")').click();
        await eappsPage.waitForTimeout(2000);

        // 5.5 填主题描述
        const descInput = eappsPage.locator('textarea[placeholder="请输入主题描述"]');
        await descInput.fill(t.desc);

        // 5.6 点「确定」（新增主题 dialog）
        const confirmBtn = eappsPage.locator('.el-dialog').first().locator('button:has-text("确定")').last();
        await confirmBtn.click();

        // 5.7 等对话框消失（textarea 不可见）
        await eappsPage.waitForSelector('textarea[placeholder="请输入主题描述"]', { state: 'hidden', timeout: 15000 });
        await eappsPage.waitForTimeout(1200);

        results.success++;
        console.log(`  ✅ 创建成功`);
      } catch (e) {
        results.failed.push({ topic: t.name, error: e.message.split('\n')[0] });
        console.log(`  ❌ 失败：${e.message.split('\n')[0]}`);
        await eappsPage.screenshot({ path: `/tmp/batch-fail-${i + 1}.png` });
        // 尝试关闭对话框继续
        try {
          await eappsPage.locator('.el-dialog button:has-text("取消")').last().click({ timeout: 2000 });
          await eappsPage.waitForTimeout(800);
        } catch {}
      }
    }

    // ─── 汇总 ───
    log('🎉 批量新增完成');
    console.log('────────────────────────────────────');
    console.log(`成功：${results.success} / ${TOPICS.length}`);
    console.log(`跳过：${results.skipped || 0}（已存在）`);
    if (results.failed.length > 0) {
      console.log(`失败：${results.failed.length}`);
      results.failed.forEach((f) => console.log(`  - ${f.topic}: ${f.error}`));
    }
    console.log(`\n验证：打开 https://eapps-betacloud.e.lanxin.cn/knowledge-library-dev/...#/knowledge/topic-list 查看`);
    console.log(`截图（如果失败）：/tmp/batch-fail-*.png`);

    process.exit(results.failed.length > 0 ? 1 : 0);
  } catch (e) {
    console.error('\n❌ 流程中断：', e.message.split('\n')[0]);
    console.error('当前 URL：', appPage.url());
    await appPage.screenshot({ path: `/tmp/batch-error-${Date.now()}.png` });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();