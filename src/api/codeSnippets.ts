// src/api/codeSnippets.ts
// 代码片段查看器 API：按 entity_id 取片段。复用全局 apiClient（自动鉴权）。设计 [[代码片段查看器-设计]] §3。
import { apiClient } from './client'
import type {
  CodeSnippet,
  ResolveSymbolPayload,
  ResolvedSymbol,
} from '@/types/codeSnippet'

/**
 * 取某实体的代码片段 + callees(带调用点) + callers。
 * @param projectId 工程 id（URL path）
 * @param entityId  实体持久 key（query 参数 entity_id）
 * @returns CodeSnippet；404 时 apiClient 抛 AxiosError（store 处理）
 */
export async function getCodeSnippet(projectId: string, entityId: string): Promise<CodeSnippet> {
  // encodeURIComponent 防 projectId 含特殊字符破坏 path；entity_id 走 params 由 axios 自动 encode
  const resp = await apiClient.get<CodeSnippet>(
    `/projects/${encodeURIComponent(projectId)}/code-snippet`,
    { params: { entity_id: entityId } },
  )
  return resp.data
}

/**
 * IDE 化光标解析：POST /code/resolve-symbol（设计 [[代码查看器-IDE化导航-设计]] §4.1）。
 * 三级解析（位置→边命中 / 名字 FTS 回退 / 接口→impl 改写）；全落空时后端返 200 + null。
 * @param projectId 工程 id（URL path）
 * @param payload   {file_path, line, col, token?, context_entity_id?, want_doc?}
 * @returns         命中 → ResolvedSymbol；全落空 → null
 */
export async function resolveSymbol(
  projectId: string,
  payload: ResolveSymbolPayload,
): Promise<ResolvedSymbol | null> {
  const resp = await apiClient.post<ResolvedSymbol | null>(
    `/projects/${encodeURIComponent(projectId)}/code/resolve-symbol`,
    payload,
  )
  return resp.data
}
