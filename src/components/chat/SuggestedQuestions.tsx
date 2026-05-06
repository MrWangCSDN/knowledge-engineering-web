/**
 * src/components/chat/SuggestedQuestions.tsx
 *
 * 空状态下的"试试问问看"卡片列表。
 * 点击发送对应问题。
 *
 * 设计文档：[[首页设计]] §3.2 状态 A
 */

interface Question {
  icon: string
  text: string
}

interface Props {
  questions: Question[]
  onSelect: (text: string) => void
}

export function SuggestedQuestions({ questions, onSelect }: Props) {
  return (
    <div className="space-y-2 max-w-md mx-auto">
      {questions.map((q, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(q.text)}
          className="
            w-full text-left p-3 border rounded-lg
            hover:bg-muted hover:border-primary/30 transition-colors
            text-sm
          "
        >
          <span className="mr-2">{q.icon}</span>
          {q.text}
        </button>
      ))}
    </div>
  )
}
