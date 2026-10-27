import type { Question, QuestionState, SectionKind } from './types'

/**
 * Decides whether a student-produced response (grid-in) matches one of the
 * accepted answers printed in the PDF, e.g. ["3/2", "1.5"] or ["-.75", "-3/4"].
 *
 * `input` is already limited to digits, ".", "/" and a leading "-" (max 5 chars, 6 if negative).
 * The SPR directions shown next to these questions spell out the rules: 3.5, 3.50 and 7/2
 * all earn credit for 3.5; for 2/3, .6666 / .6667 / 0.666 / 0.667 earn credit but .66 / 0.67 don't.
 */
export function isSprCorrect(input: string, accepted: string[]): boolean {
  // TODO(human): replace this exact-text comparison with real grid-in matching.
  const norm = (s: string) => s.trim().replace(/\s+/g, '')
  return accepted.some((a) => norm(a) === norm(input))
}

/** `null` when the PDF had no answer key for this question. */
export function isCorrect(q: Question, answer: string | null): boolean | null {
  if (!q.correct || q.correct.length === 0) return null
  if (answer === null || answer.trim() === '') return false
  return q.choices ? q.correct.includes(answer) : isSprCorrect(answer, q.correct)
}

export interface Tally {
  correct: number
  total: number
}

export interface Summary {
  overall: Tally
  bySection: Partial<Record<SectionKind, Tally>>
  byDomain: Record<string, Tally>
  bySkill: Record<string, Tally & { domain: string }>
  byDifficulty: Record<string, Tally>
  graded: boolean
  totalTime: number
}

export function summarize(questions: Question[], states: Record<string, QuestionState>): Summary {
  const s: Summary = { overall: t(), bySection: {}, byDomain: {}, bySkill: {}, byDifficulty: {}, graded: false, totalTime: 0 }
  for (const q of questions) {
    const st = states[q.id]
    s.totalTime += st?.timeSpent ?? 0
    const ok = isCorrect(q, st?.answer ?? null)
    if (ok === null) continue
    s.graded = true
    const add = (x: Tally) => {
      x.total++
      if (ok) x.correct++
    }
    add(s.overall)
    add((s.bySection[q.section] ??= t()))
    add((s.byDomain[q.domain || 'Other'] ??= t()))
    add((s.bySkill[q.skill || 'Other'] ??= { ...t(), domain: q.domain }))
    add((s.byDifficulty[q.difficulty || 'Unknown'] ??= t()))
  }
  return s
}

function t(): Tally {
  return { correct: 0, total: 0 }
}
