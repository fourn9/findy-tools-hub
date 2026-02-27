import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages では /<repo-name>/ がベースになる。
  // CI 環境変数 BASE_URL で上書き可能（GitHub Actions が自動設定）。
  // Vercel / Netlify はルート `/` のままで動作する。
  base: process.env.BASE_URL ?? '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // 開発時: /api/* → バックエンド (port 3000) に転送
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 大きなチャンクを分割してロード速度を改善
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
