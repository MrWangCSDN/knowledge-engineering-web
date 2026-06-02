// src/components/code/calleeDecorations.ts
// 把后端 callees（文件绝对行 + 0-indexed col）换算成 Monaco 装饰范围（片段内 1-indexed 行 + 1-indexed col）。
// 纯函数便于单测；MonacoSnippet 据此 deltaDecorations。设计 [[代码片段查看器-设计]] §5。
import type { CalleeRef } from '@/types/codeSnippet'

/** 一个调用点的装饰范围（Monaco 坐标，1-indexed）。 */
export interface CalleeDecoration {
  entityId: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  wholeLine: boolean         // col 缺失 → 整行高亮兜底（设计 §7）
}

/**
 * 把后端调用点列表换算成 Monaco 片段内装饰范围。
 *
 * @param callees   后端调用点（line 文件绝对行 1-indexed、col 0-indexed，可能 null）
 * @param startLine 片段在文件中的起始行（1-indexed）
 * @returns 片段内可点击装饰范围（跳过无 line / 越界项）
 */
export function computeCalleeDecorations(callees: CalleeRef[], startLine: number): CalleeDecoration[] {
  // 结果数组，逐个 callee 判断是否可以定位
  const out: CalleeDecoration[] = []

  // for...of 遍历数组，c 是当前 callee
  for (const c of callees) {
    // line 为 null → 无法定位行 → 直接跳过（continue 跳到下次迭代）
    if (c.line == null) continue

    // 文件绝对行（1-indexed）换算到片段内行（1-indexed）
    // 例：文件第 104 行，片段起始 100 → 片段内第 5 行（104 - 100 + 1 = 5）
    const sLine = c.line - startLine + 1

    // 片段内行 < 1 表示调用点在片段起始行之前（脏数据）→ 跳过
    if (sLine < 1) continue

    if (c.col == null) {
      // col 为 null：无列号，退化为整行高亮（wholeLine = true）
      // startColumn / endColumn 填 1（Monaco 接口要求非零，但整行模式不使用列号）
      out.push({
        entityId: c.entity_id,
        startLineNumber: sLine,
        startColumn: 1,
        endLineNumber: sLine,
        endColumn: 1,
        wholeLine: true,
      })
    } else {
      // col 0-indexed → Monaco 1-indexed：+1
      const startColumn = c.col + 1
      // endColumn = startColumn + 方法名长度（高亮覆盖整个方法名，左闭右开与 Monaco range 语义一致）
      const endColumn = startColumn + (c.name?.length ?? 0)
      out.push({
        entityId: c.entity_id,
        startLineNumber: sLine,
        startColumn,
        endLineNumber: sLine,
        endColumn,
        wholeLine: false,
      })
    }
  }

  return out
}
