import { sectionLabel, useApp } from '@/lib/store'
import type { Module } from '@/lib/types'
import { Legend, QuestionGrid } from './QuestionGrid'

/** Bluebook's "Check Your Work" page at the end of each module. */
export function ReviewPage({ module }: { module: Module }) {
  const states = useApp((s) => s.states)
  const goTo = useApp((s) => s.goTo)
  const unanswered = module.questionIds.filter((id) => !states[id]?.answer).length

  return (
    <div className="h-full overflow-y-auto px-4 py-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-bb-ink">Check Your Work</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-bb-ink">
          On test day, you won't be able to move on to the next module until time expires.
          <br />
          For these practice questions, you can click <strong>Next</strong> when you're ready to move on.
        </p>
        <div className="mt-8 rounded-xl bg-white p-6 text-left shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-bb-ink">
              Section {module.sectionNumber}, Module {module.moduleNumber}: {sectionLabel(module.section)} Questions
            </h2>
          </div>
          <div className="bb-dash-bottom my-4 h-px" />
          <Legend />
          <div className="bb-dash-bottom my-4 h-px" />
          <QuestionGrid ids={module.questionIds} states={states} current={null} onPick={goTo} />
          {unanswered > 0 && (
            <p className="mt-6 text-center text-sm text-neutral-600">
              {unanswered} question{unanswered === 1 ? '' : 's'} unanswered. There's no penalty for guessing.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
