// 骨架入口 —— 命令层业务(CLI 子命令 + serve 子命令 + core)阶段 1 才写。
// 此阶段仅验证 tsup 打包链通(npm run build 能产出 dist/registry.js)。
// 详见 skill-install/DESIGN.md §九 阶段 1/阶段 2。
const argv = process.argv.slice(2)
console.log('registry skeleton, args:', argv)
