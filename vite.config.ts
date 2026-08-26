import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const maximumFileSizeToCacheInBytes = 10 * 1024 * 1024;
const localCommonJSModules = [/electron[\\/]services/, /shared[\\/].*\.cjs/];
const browserCommonJS = Object.assign(commonjs({
  filter(id) {
    const cleanId = id.split('?', 1)[0];
    return localCommonJSModules.some((pattern) => pattern.test(cleanId));
  },
}), { apply: 'serve' as const });

export default defineConfig({
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.cjs'],
  },
  build: {
    commonjsOptions: {
      include: [...localCommonJSModules, /node_modules/],
    },
  },
  plugins: [
    browserCommonJS,
    react(),
    VitePWA({
      injectRegister: null,
      registerType: 'prompt',
      manifest: {
        id: './',
        name: '问爻',
        short_name: '问爻',
        description: '本地优先的六爻起卦、排盘与古籍检索工具',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#d8d2c5',
        theme_color: '#232421',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{html,js,css,png,svg,webp,avif,ttf,woff,woff2,json,webmanifest,f32}'],
        maximumFileSizeToCacheInBytes,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    globals: true,
    exclude: ['electron/**/*.test.cjs', '**/node_modules/**', 'dist/**', 'release/**'],
  },
});
