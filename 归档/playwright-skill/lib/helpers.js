// 浏览器自动化辅助函数
// 当前只保留 detectDevServers；其它能力按需扩展。

const http = require('http');

/**
 * 探测常见端口是否有 dev server 在跑
 * @param {number[]} customPorts - 追加的自定义端口
 * @returns {Promise<string[]>} 命中的 URL 列表，如 ['http://localhost:3001']
 */
async function detectDevServers(customPorts = []) {
  const commonPorts = [3000, 3001, 3002, 5173, 8080, 8000, 4200, 5000, 9000, 1234];
  const ports = [...new Set([...commonPorts, ...customPorts])];

  const found = [];

  console.log('🔍 正在探测本地 dev server ...');

  await Promise.all(ports.map((port) =>
    new Promise((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/',
          method: 'HEAD',
          timeout: 500,
        },
        (res) => {
          if (res.statusCode < 500) {
            found.push(`http://localhost:${port}`);
            console.log(`  ✅ 端口 ${port} 有响应（${res.statusCode}）`);
          }
          resolve();
        },
      );
      req.on('error',   () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.end();
    }),
  ));

  if (found.length === 0) {
    console.log('  ❌ 未探测到任何 dev server');
  }

  return found;
}

module.exports = { detectDevServers };