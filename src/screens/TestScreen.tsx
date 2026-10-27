import { ChevronsLeftRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Annotatable } from '@/components/bluebook/Annotatable'
import { Calculator } from '@/components/bluebook/Calculator'
import { SprDirections } from '@/components/bluebook/Directions'
import { Footer } from '@/components/bluebook/Footer'
import { Header } from '@/components/bluebook/Header'
import { LineReader } from '@/components/bluebook/LineReader'
import { QuestionPane } from '@/components/bluebook/QuestionPane'
import { ReferenceSheet } from '@/components/bluebook/ReferenceSheet'
import { ReviewPage } from '@/components/bluebook/ReviewPage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { questionMap, useApp } from '@/lib/store'
import type { Question } from '@/lib/types'
import { cn } from '@/lib/utils'

export function TestScreen() {
  const set = useApp((s) => s.set)
  const module = useApp((s) => s.modules[s.moduleIndex])
  const index = useApp((s) => s.index)
  const onReviewPage = useApp((s) => s.onReviewPage)
  const states = useApp((s) => s.states)
  const settings = useApp((s) => s.settings)
  const timeUp = useApp((s) => s.timeUp)
  const moduleIndex = useApp((s) => s.moduleIndex)
  const isLastModule = useApp((s) => s.moduleIndex === s.modules.length - 1)
  const actions = useApp.getState()

  const [calcOpen, setCalcOpen] = useState(false)
  const [calcMounted, setCalcMounted] = useState(false)
  const [refOpen, setRefOpen] = useState(false)
  const [lineReader, setLineReader] = useState(false)

  const qmap = useMemo(() => questionMap(set), [set])

  // One-second clock for the module timer and per-question time.
  useEffect(() => {
    const t = setInterval(() => useApp.getState().tick(), 1000)
    return () => clearInterval(t)
  }, [])

  // Tools belong to a module; reset them when it changes.
  useEffect(() => {
    setCalcOpen(false)
    setRefOpen(false)
  }, [moduleIndex])

  // ←/→ for Back/Next, but never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable], iframe') || e.altKey || e.metaKey || e.ctrlKey) return
      if (e.key === 'ArrowRight') useApp.getState().next()
      if (e.key === 'ArrowLeft') useApp.getState().back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!module || !set) return null
  const qid = module.questionIds[index]
  const q = qmap.get(qid)
  const st = states[qid]
  const immediate = settings.feedback === 'immediate'
  const questionSeconds = settings.timingMode === 'perQuestion' && st ? settings.secondsPerQuestion - st.timeSpent : null

  return (
    <div className="flex h-dvh flex-col bg-white">
      <Header
        key={moduleIndex}
        module={module}
        calculatorOpen={calcOpen}
        referenceOpen={refOpen}
        lineReaderOpen={lineReader}
        onCalculator={() => {
          setCalcMounted(true)
          setCalcOpen((v) => !v)
        }}
        onReference={() => setRefOpen((v) => !v)}
        onLineReader={() => setLineReader((v) => !v)}
        questionSeconds={onReviewPage ? null : questionSeconds}
      />

      <main className="relative min-h-0 flex-1">
        {onReviewPage || !q || !st ? (
          <ReviewPage module={module} />
        ) : (
          <QuestionLayout key={qid} q={q} number={index + 1} reveal={immediate && st.checked} />
        )}
      </main>

      <Footer module={module} canCheck={immediate && !!st && !!st.answer && !st.checked} />

      {calcMounted && module.section === 'math' && (
        <div className={cn(!calcOpen && 'hidden')}>
          <Calculator onClose={() => setCalcOpen(false)} />
        </div>
      )}
      {refOpen && module.section === 'math' && <ReferenceSheet onClose={() => setRefOpen(false)} />}
      {lineReader && <LineReader onClose={() => setLineReader(false)} />}

      <Dialog open={timeUp}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Time's up</DialogTitle>
            <DialogDescription>
              {isLastModule
                ? 'This module has ended. Your answers have been saved, so let’s look at how you did.'
                : 'This module has ended and your answers have been saved. Get ready for the next module.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="rounded-full px-6" onClick={actions.dismissTimeUp}>
              {isLastModule ? 'See Results' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuestionLayout({ q, number, reveal }: { q: Question; number: number; reveal: boolean }) {
  const st = useApp((s) => s.states[q.id])
  const { answer, toggleEliminate, toggleMark } = useApp.getState()
  const isSpr = !q.choices
  const split = q.section === 'rw' ? q.stimulus.length > 0 : isSpr

  const pane = (
    <QuestionPane
      q={q}
      state={st}
      number={number}
      actions={{ answer, toggleEliminate, toggleMark }}
      reveal={reveal}
      annotate={q.section === 'rw'}
    />
  )

  if (!split) {
    return <div className="h-full overflow-y-auto px-4 pt-8 pb-16 sm:px-8">{pane}</div>
  }
  const left =
    q.section === 'rw' ? (
      <div className="mx-auto max-w-[44rem]">
        <Annotatable questionId={q.id} blocks={q.stimulus} />
      </div>
    ) : (
      <div className="mx-auto max-w-[40rem]">
        <SprDirections />
      </div>
    )
  return <SplitPane left={left} right={pane} />
}

/** Bluebook's two-pane layout with a draggable divider. Stacks on narrow screens. */
function SplitPane({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const [ratio, setRatio] = useState(0.5)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  return (
    <div
      ref={ref}
      className="flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden"
      onPointerMove={(e) => {
        if (!dragging.current || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        setRatio(Math.min(0.8, Math.max(0.2, (e.clientX - r.left) / r.width)))
      }}
      onPointerUp={() => (dragging.current = false)}
    >
      <section className="shrink-0 px-4 pt-8 pb-10 sm:px-8 md:min-h-0 md:shrink md:basis-[var(--split)] md:overflow-y-auto md:pb-16" style={{ ['--split' as string]: `${ratio * 100}%` }}>
        {left}
      </section>
      <div className="relative hidden w-[6px] shrink-0 bg-neutral-300 md:block">
        <button
          aria-label="Resize panes"
          className="absolute top-1/2 left-1/2 grid h-10 w-6 -translate-x-1/2 -translate-y-1/2 cursor-col-resize touch-none place-items-center rounded-md bg-bb-ink text-white"
          onPointerDown={(e) => {
            dragging.current = true
            ;(e.currentTarget.parentElement!.parentElement as HTMLElement).setPointerCapture(e.pointerId)
          }}
          onDoubleClick={() => setRatio(0.5)}
        >
          <ChevronsLeftRight className="size-4" />
        </button>
      </div>
      <section className="flex-1 border-t md:min-h-0 md:overflow-y-auto border-neutral-300 px-4 pt-8 pb-16 sm:px-8 md:border-t-0">{right}</section>
    </div>
  )
}
