import axios from 'axios'

/**
 * Axios 实例：
 * - 开发环境走 vite proxy（/api → http://localhost:8000），保持同源
 * - 生产环境可通过 VITE_API_BASE_URL 覆盖
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// 简单的全局错误日志（后续可换 toast）
apiClient.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[api]', err?.response?.status, err?.config?.url, err?.message)
    }
    return Promise.reject(err)
  },
)
