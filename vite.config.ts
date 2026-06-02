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
    // zustand 也 dedupe：@xyflow/react 内嵌 zustand@4，强制全应用单实例，避免多份 create 绑定
    dedupe: ['react', 'react-dom', 'zustand'],
  },
  // 2026-06-02：把 @xyflow/react 显式预打包，避免开发态 nested zustand 走 Vite 模块隔离
  optimizeDeps: {
    include: ['@xyflow/react'],
  },
  // 2026-06-02 修生产白屏：把 zustand 切成纯 vendor chunk（无应用代码 → 无循环 → 必先初始化）。
  // 否则代码片段查看器新增的 store 扰动 chunk 图后，某 store chunk 会在 zustand chunk 之前执行 →
  // 顶层 create() 时 create 仍 undefined → "create is not a function" 整页白屏（含登录页）。
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/zustand')) return 'vendor-zustand'
        },
      },
    },
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
