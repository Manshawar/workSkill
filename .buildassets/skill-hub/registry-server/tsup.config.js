import { defineConfig } from 'tsup'

// 打包成单文件 CJS/ESM,落地到本仓 dist/registry.js。
// 发布动作:把 dist/registry.js 拷进 skill-install/bin/registry.js(随包分发)。
// 阶段 1 才填真正的入口与 core,此处仅骨架。
export default defineConfig({
  entry: ['src/registry.js'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  // 单文件,内联依赖(node_modules 不随包走,只有产物走)
  noExternal: [/.*/],
  minify: false,
  splitting: false,
  sourcemap: false,
})
