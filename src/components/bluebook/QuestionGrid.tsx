import type { QuestionState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BookmarkIcon, PinIcon } from './icons'

export function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-bb-ink">
      <span className="flex items-center gap-2">
        <PinIcon /> Current
      </span>
      <span className="flex items-center gap-2">
        <span className="size-4 border border-dashed border-bb-ink" /> Unanswered
      </span>
      <span className="flex items-center gap-2">
        <BookmarkIcon filled /> For Review
      </span>
    </div>
  )
}

export function QuestionGrid({
  ids,
  states,
  current,
  onPick,
}: {
  ids: string[]
  states: Record<string, QuestionState>
  current: number | null
  onPick(index: number): void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-6 pt-3">
      {ids.map((id, i) => {
        const st = states[id]
        const answered = !!st?.answer
        return (
          <button
            key={id}
            onClick={() => onPick(i)}
            className={cn(
              'relative grid size-10 place-items-center text-[15px] font-bold transition-colors',
              answered ? 'bg-bb-blue text-white hover:bg-bb-blue-dark' : 'border border-dashed border-bb-ink text-bb-blue hover:bg-blue-50',
            )}
            aria-label={`Question ${i + 1}${answered ? ', answered' : ', unanswered'}${st?.marked ? ', marked for review' : ''}`}
          >
            {i + 1}
            {current === i && <PinIcon className="absolute -top-5 left-1/2 h-4 -translate-x-1/2" />}
            {st?.marked && <BookmarkIcon filled className="absolute -top-1.5 -right-1.5 h-3.5 w-3" />}
          </button>
        )
      })}
    </div>
  )
}
