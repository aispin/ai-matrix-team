import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' 让 dist 可被任意静态目录托管（专家团 server 直接吃 dist）
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 4781, proxy: { '/api': 'http://127.0.0.1:4780' } },
  build: { outDir: 'dist', sourcemap: false },
});
