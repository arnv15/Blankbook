import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { isCorrect } from '@/lib/scoring'
import type { Choice, Letter, Question, QuestionState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Annotatable } from './Annotatable'
import { BlockView, CropImage } from './BlockView'
import { BookmarkIcon, EliminatorIcon } from './icons'

export interface QuestionActions {
  answer(value: string | null): void
  toggleEliminate(letter: Letter): void
  toggleMark(): void
}

interface Props {
  q: Question
  state: QuestionState
  number: number
  actions?: QuestionActions
  /** Show correct/incorrect marks and the explanation. */
  reveal: boolean
  annotate: boolean
}

/** The right-hand pane: question bar, prompt, and choices or the grid-in box. */
export function QuestionPane({ q, state, number, actions, reveal, annotate }: Props) {
  const [eliminator, setEliminator] = useState(false)
  const locked = reveal || !actions

  return (
    <div className="mx-auto w-full max-w-[44rem]">
      <div className="bb-dash-bottom flex h-10 items-stretch bg-[#f1f1f1] pb-[1.5px]">
        <div className="grid w-10 place-items-center bg-bb-ink text-lg font-bold text-white">{number}</div>
        <button
          className="flex items-center gap-2 px-3 text-[15px] font-medium text-bb-ink hover:underline disabled:no-underline"
          onClick={() => actions?.toggleMark()}
          disabled={!actions}
          aria-pressed={state.marked}
        >
          <BookmarkIcon filled={state.marked} />
          {state.marked ? 'Marked for Review' : 'Mark for Review'}
        </button>
        {q.choices && !locked && (
          <button
            className={cn(
              'my-1.5 mr-2 ml-auto grid w-11 place-items-center rounded border-[1.5px] text-bb-ink',
              eliminator ? 'border-bb-blue bg-bb-blue text-white' : 'border-neutral-500 bg-white',
            )}
            onClick={() => setEliminator((v) => !v)}
            aria-pressed={eliminator}
            aria-label="Cross out answer choices"
            title="Cross out answer choices you think are wrong"
          >
            <EliminatorIcon />
          </button>
        )}
      </div>

      <div className="px-1 pt-5">
        {annotate ? <Annotatable questionId={q.id} blocks={q.prompt} /> : <BlockView blocks={q.prompt} />}

        <div className="mt-6">
          {q.choices ? (
            <div className="space-y-4">
              {q.choices.map((c) => (
                <ChoiceRow
                  key={c.letter}
                  choice={c}
                  selected={state.answer === c.letter}
                  eliminated={state.eliminated.includes(c.letter)}
                  showEliminator={eliminator && !locked}
                  locked={locked}
                  result={reveal ? (q.correct?.includes(c.letter) ? 'correct' : state.answer === c.letter ? 'wrong' : null) : null}
                  onSelect={() => actions?.answer(state.answer === c.letter ? null : c.letter)}
                  onEliminate={() => actions?.toggleEliminate(c.letter)}
                />
              ))}
            </div>
          ) : (
            <SprInput value={state.answer ?? ''} locked={locked} onChange={(v) => actions?.answer(v || null)} />
          )}
        </div>

        {reveal && <Explanation q={q} answer={state.answer} />}
      </div>
    </div>
  )
}

function ChoiceRow({
  choice,
  selected,
  eliminated,
  showEliminator,
  locked,
  result,
  onSelect,
  onEliminate,
}: {
  choice: Choice
  selected: boolean
  eliminated: boolean
  showEliminator: boolean
  locked: boolean
  result: 'correct' | 'wrong' | null
  onSelect(): void
  onEliminate(): void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={locked}
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'group relative flex min-h-[3.25rem] flex-1 items-center gap-4 rounded-[10px] border bg-white px-3 py-2.5 text-left transition-shadow disabled:cursor-default',
          result === 'correct'
            ? 'border-emerald-600 shadow-[0_0_0_2px_#059669]'
            : result === 'wrong'
              ? 'border-bb-red shadow-[0_0_0_2px_var(--bb-red)]'
              : selected
                ? 'border-bb-blue shadow-[0_0_0_2px_var(--bb-blue)]'
                : 'border-neutral-500 enabled:hover:shadow-[0_0_0_1px_var(--bb-blue)]',
          eliminated && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-sm font-bold',
            result === 'correct'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : result === 'wrong'
                ? 'border-bb-red bg-bb-red text-white'
                : selected
                  ? 'border-bb-blue bg-bb-blue text-white'
                  : 'border-bb-ink text-bb-ink',
          )}
        >
          {choice.letter}
        </span>
        <BlockView blocks={choice.blocks} className="min-w-0 flex-1 [&_p]:leading-snug" />
        {result === 'correct' && <Check className="size-5 shrink-0 text-emerald-600" />}
        {result === 'wrong' && <X className="size-5 shrink-0 text-bb-red" />}
        {eliminated && <span className="pointer-events-none absolute top-1/2 right-[-6px] left-[-6px] h-[2px] bg-bb-ink" />}
      </button>
      {showEliminator && (
        <button
          type="button"
          onClick={onEliminate}
          className="w-10 shrink-0 text-center text-sm font-semibold text-bb-ink"
          aria-label={eliminated ? `Undo cross out ${choice.letter}` : `Cross out ${choice.letter}`}
        >
          {eliminated ? (
            <span className="underline">Undo</span>
          ) : (
            <span className="relative mx-auto grid size-7 place-items-center rounded-full border-[1.5px] border-bb-ink">
              {choice.letter}
              <span className="absolute top-1/2 right-[-5px] left-[-5px] h-[1.5px] bg-bb-ink" />
            </span>
          )}
        </button>
      )}
    </div>
  )
}

/** Grid-in rules: digits, one decimal point or slash, optional leading minus; 5 chars (6 with minus). */
export function sanitizeSpr(raw: string): string {
  let v = raw.replace(/[^0-9./-]/g, '')
  v = v.replace(/(?!^)-/g, '')
  const neg = v.startsWith('-')
  return v.slice(0, neg ? 6 : 5)
}

function SprInput({ value, locked, onChange }: { value: string; locked: boolean; onChange(v: string): void }) {
  return (
    <div className="font-sans">
      <input
        value={value}
        disabled={locked}
        inputMode="decimal"
        aria-label="Your answer"
        onChange={(e) => onChange(sanitizeSpr(e.target.value))}
        className="h-12 w-40 rounded-md border-[1.5px] border-neutral-500 border-b-[3px] border-b-bb-ink px-3 font-serif text-xl outline-none focus:border-bb-blue disabled:bg-neutral-50"
      />
      <div className="mt-3 text-[15px] text-bb-ink">
        Answer Preview: <span className="font-serif font-semibold">{renderPreview(value)}</span>
      </div>
    </div>
  )
}

function renderPreview(v: string) {
  const m = /^(-?)(\d*\.?\d*)\/(\d*\.?\d*)$/.exec(v)
  if (!m) return v
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {m[1]}
      <span className="inline-flex flex-col items-center text-sm leading-tight">
        <span className="border-b border-current px-0.5">{m[2] || ' '}</span>
        <span className="px-0.5">{m[3] || ' '}</span>
      </span>
    </span>
  )
}

export function Explanation({ q, answer }: { q: Question; answer: string | null }) {
  const ok = isCorrect(q, answer)
  return (
    <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-sans">
      {ok === null ? (
        <p className="text-sm text-neutral-600">This PDF didn't include an answer key for this question.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn('flex items-center gap-1.5 font-semibold', ok ? 'text-emerald-700' : 'text-bb-red')}>
            {ok ? <Check className="size-4" /> : <X className="size-4" />}
            {ok ? 'Correct' : answer ? 'Incorrect' : 'Not answered'}
          </span>
          <span className="text-sm text-neutral-700">
            Correct answer: <strong>{q.correct?.join(' or ')}</strong>
            {answer && !ok && (
              <>
                {' '}
                · Your answer: <strong>{answer}</strong>
              </>
            )}
          </span>
        </div>
      )}
      {q.correctCrop && (
        <div className="mt-2">
          <CropImage crop={q.correctCrop} />
        </div>
      )}
      {q.rationale.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-neutral-200 pt-4">
          <div className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Explanation</div>
          <BlockView blocks={q.rationale} className="text-[15px]" />
        </div>
      )}
    </div>
  )
}
