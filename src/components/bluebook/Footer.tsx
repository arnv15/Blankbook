import { ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { sectionLabel, useApp } from '@/lib/store'
import type { Module } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Legend, QuestionGrid } from './QuestionGrid'

interface Props {
  module: Module
  /** Immediate-feedback mode: show a Check button for the current question. */
  canCheck: boolean
}

export function Footer({ module, canCheck }: Props) {
  const index = useApp((s) => s.index)
  const onReviewPage = useApp((s) => s.onReviewPage)
  const states = useApp((s) => s.states)
  const { next, back, goTo, openReviewPage, check } = useApp.getState()
  const [navOpen, setNavOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)
  const n = module.questionIds.length
  const isLastModule = useApp((s) => s.moduleIndex === s.modules.length - 1)

  useEffect(() => {
    if (!navOpen) return
    const close = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setNavOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [navOpen])

  return (
    <footer className="bb-dash-top relative z-20 shrink-0 bg-bb-chrome">
      <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-7">
        <div className="invisible truncate text-sm font-semibold text-neutral-500 sm:visible">Blankbook</div>

        <div ref={popRef} className="relative">
          {!onReviewPage && (
            <button
              onClick={() => setNavOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-bb-ink px-3.5 py-2 text-sm font-semibold text-white hover:bg-black"
              aria-expanded={navOpen}
            >
              Question {index + 1} of {n}
              <ChevronUp className={cn('size-4 transition-transform', !navOpen && 'rotate-180')} />
            </button>
          )}
          {navOpen && (
            <div className="absolute bottom-full left-1/2 mb-4 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl bg-white p-5 shadow-[0_8px_40px_rgba(0,0,0,0.25)]">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-base font-bold text-bb-ink">
                  Section {module.sectionNumber}, Module {module.moduleNumber}: {sectionLabel(module.section)} Questions
                </h2>
                <button aria-label="Close" onClick={() => setNavOpen(false)} className="-m-1 rounded p-1 hover:bg-neutral-100">
                  <X className="size-5" />
                </button>
              </div>
              <div className="bb-dash-bottom my-3 h-px" />
              <Legend />
              <div className="bb-dash-bottom my-3 h-px" />
              <div className="max-h-[45vh] overflow-y-auto pb-1">
                <QuestionGrid
                  ids={module.questionIds}
                  states={states}
                  current={index}
                  onPick={(i) => {
                    goTo(i)
                    setNavOpen(false)
                  }}
                />
              </div>
              <div className="mt-5 flex justify-center">
                <button
                  className="rounded-full border-[1.5px] border-bb-blue px-5 py-1.5 text-sm font-semibold text-bb-blue hover:bg-blue-50"
                  onClick={() => {
                    openReviewPage()
                    setNavOpen(false)
                  }}
                >
                  Go to Review Page
                </button>
              </div>
              <div className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 bg-white" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          {canCheck && !onReviewPage && (
            <button className="rounded-full border-[1.5px] border-bb-blue bg-white px-5 py-2 text-sm font-semibold text-bb-blue hover:bg-blue-50" onClick={check}>
              Check
            </button>
          )}
          {(index > 0 || onReviewPage) && <NavButton onClick={back}>Back</NavButton>}
          <NavButton onClick={next}>{onReviewPage ? (isLastModule ? 'Finish' : 'Next') : 'Next'}</NavButton>
        </div>
      </div>
    </footer>
  )
}

function NavButton(props: React.ComponentProps<'button'>) {
  return <button {...props} className="rounded-full bg-bb-blue px-6 py-2 text-sm font-semibold text-white hover:bg-bb-blue-dark" />
}
