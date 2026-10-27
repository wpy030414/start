import { defineConfig, type PluginOption, type UserConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// 本地开发与预览恒为根路径；
// CI 注入 PAGES_BASE_PATH 决定线上前缀：项目页 /<repo>/，自定义域或用户页 /
// 代码不做任何域名或仓库名推断
const base = process.env.PAGES_BASE_PATH || '/';

const plugins = [
  react(),
  VitePWA({
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    filename: 'sw.js',
    includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
    manifest: {
      name: '开始',
      short_name: '开始',
      description: 'macOS Liquid Glass 风格浏览器起始页',
      lang: 'zh-CN',
      dir: 'ltr' as const,
      // manifest 里的地址不会被 Vite 自动加 base 前缀，必须显式拼接
      start_url: base,
      scope: base,
      display: 'standalone',
      orientation: 'any',
      background_color: '#050505',
      theme_color: '#333333',
      icons: [
        { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
        {
          src: `${base}icons/icon-512-maskable.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
    },
  }),
  // 插件由真实 vite 的 Plugin 类型声明，vp 期望的是 vite-plus core 的类型，
  // 两者结构一致但类型身份不同，这里在边界处桥接一次
] as unknown as PluginOption[];

// 显式标注 UserConfig：defineConfig 的泛型约束会把对象字面量与 ViteUserConfigExport
// 做深层结构比较，VitePWA 的 workbox 选项过深时 TS 会报 TS2321（栈深溢出）。
const config: UserConfig = {
  base,
  plugins,
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: { target: 'es2022' },
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  // 与既有代码风格一致：保留分号、单引号，行宽沿用项目原有的 120
  fmt: {
    semi: true,
    singleQuote: true,
    printWidth: 120,
    // 中文文档的表格由人工排版，交给 oxfmt 会把对齐重算成大量无意义 diff
    ignorePatterns: ['**/*.md'],
  },
  lint: {
    // 必须显式排除，否则 vp lint 会扫描 node_modules
    ignorePatterns: ['node_modules/**', 'dist/**'],
    options: { typeAware: true, typeCheck: true },
  },
};

export default defineConfig(config);
