// /tmp/probe-login.js
// 探针：打开登陆页，dump 全部可见的 input / button / 关键文案，辅助调试选择器
const { chromium } = require('playwright');

const URL = 'https://user-betacloud.e.lanxin.cn/user/passport/pc/login?redirect_uri=https%3A%2F%2Fwork-betacloud.e.lanxin.cn%2Fwork%2Femc%2Fapp-center%2Fapp-manage-list%2F16277504%2F2621440%2Fdetail';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => console.log('goto warn:', e.message));
  await page.waitForTimeout(3000);

  console.log('=== 标题 ===');
  console.log(await page.title());
  console.log('=== URL ===');
  console.log(page.url());

  console.log('\n=== 全部 input 元素 ===');
  const inputs = await page.locator('input').all();
  for (let i = 0; i < inputs.length; i++) {
    const info = await inputs[i].evaluate((el) => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      maxlength: el.maxLength,
      className: el.className,
      visible: el.offsetParent !== null,
      value: el.value,
    }));
    if (info.visible) console.log(`  [${i}]`, JSON.stringify(info));
  }

  console.log('\n=== 全部 button 元素 ===');
  const btns = await page.locator('button').all();
  for (let i = 0; i < btns.length; i++) {
    const info = await btns[i].evaluate((el) => ({
      text: el.innerText?.trim().slice(0, 30),
      type: el.type,
      className: el.className?.slice(0, 50),
      visible: el.offsetParent !== null,
    }));
    if (info.visible) console.log(`  [${i}]`, JSON.stringify(info));
  }

  console.log('\n=== 关键文案定位 ===');
  const texts = ['下一步', '登录', '手机', '验证码', '密码', '账号', '手机号'];
  for (const t of texts) {
    const cnt = await page.locator(`text=${t}`).count();
    if (cnt > 0) console.log(`  "${t}": ${cnt} 个匹配`);
  }

  console.log('\n=== 整页 body 文本（前 1500 字）===');
  console.log((await page.locator('body').innerText()).slice(0, 1500));

  await page.screenshot({ path: '/tmp/probe-login.png', fullPage: true });
  console.log('\n📸 /tmp/probe-login.png');

  await browser.close();
})();