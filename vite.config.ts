import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // 2026-06-02：强制 react / react-dom 单实例 —— @xyflow/react 嵌套了 zustand@4，
    // 在 React 19 下 Vite 默认 module 解析会让 nested deps 拿到第二份 React binding
    // → "Invalid hook call" + edges/minimap 不渲染。dedupe 让它们指向顶层同一份 React
    dedupe: ['react', 'react-dom'],
  },
  // 2026-06-02：把 @xyflow/react 显式预打包，避免开发态 nested zustand 走 Vite 模块隔离
  optimizeDeps: {
    include: ['@xyflow/react'],
  },
  server: {
    port: 5173,
    proxy: {
      // 把 /api/* 转发到后端 FastAPI（默认 8000 端口）
      '/api': {
        target: 'http://localhost:8000',
        // changeOrigin: false —— 保留浏览器原始 Host header (localhost:5173/5174)
        // 否则 vite 默认会把 Host 改成 target host (localhost:8000)，
        // 与浏览器送的 Origin (http://localhost:5173) 不匹配 →
        // 后端 CSRF 检查 `host not in origin` 返回 403 → /auth/refresh 失败 →
        // 用户刷新页面被踢回登录页（bug 复现于 2026-05-15）
        changeOrigin: false,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
