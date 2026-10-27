import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Highlight, Letter, Module, Question, QuestionSet, QuestionState, SectionKind, TestSettings } from './types'

export type Screen = 'home' | 'test' | 'break' | 'results'

export const DEFAULT_SETTINGS: TestSettings = {
  timingMode: 'bluebook',
  totalMinutes: 30,
  secondsPerQuestion: 75,
  autoAdvance: false,
  feedback: 'end',
  shuffle: false,
  splitModules: true,
  includeBreak: false,
}

/** Real digital SAT module sizes and lengths. */
export const BLUEBOOK = {
  rw: { questions: 27, seconds: 32 * 60, label: 'Reading and Writing' },
  math: { questions: 22, seconds: 35 * 60, label: 'Math' },
} as const

export const BREAK_SECONDS = 10 * 60

export function sectionLabel(s: SectionKind) {
  return BLUEBOOK[s].label
}

export function buildModules(questions: Question[], settings: TestSettings): Module[] {
  const order: SectionKind[] = ['rw', 'math']
  const present = order.filter((s) => questions.some((q) => q.section === s))
  const modules: Module[] = []
  present.forEach((section, si) => {
    let qs = questions.filter((q) => q.section === section).map((q) => q.id)
    if (settings.shuffle) qs = shuffle(qs)
    const size = settings.splitModules ? BLUEBOOK[section].questions : qs.length
    for (let i = 0; i < qs.length; i += size) {
      modules.push({ section, sectionNumber: si + 1, moduleNumber: i / size + 1, questionIds: qs.slice(i, i + size), seconds: null })
    }
  })
  const totalQ = modules.reduce((n, m) => n + m.questionIds.length, 0)
  for (const m of modules) {
    const n = m.questionIds.length
    switch (settings.timingMode) {
      case 'bluebook':
        m.seconds = Math.max(60, Math.round((BLUEBOOK[m.section].seconds * n) / BLUEBOOK[m.section].questions / 60) * 60)
        break
      case 'total':
        m.seconds = Math.max(30, Math.round((settings.totalMinutes * 60 * n) / totalQ))
        break
      case 'perQuestion':
        m.seconds = n * settings.secondsPerQuestion
        break
      case 'untimed':
        m.seconds = null
    }
  }
  return modules
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const blankState = (): QuestionState => ({ answer: null, eliminated: [], marked: false, checked: false, timeSpent: 0 })

interface State {
  screen: Screen
  set: QuestionSet | null
  setId: string | null
  settings: TestSettings
  modules: Module[]
  moduleIndex: number
  index: number
  onReviewPage: boolean
  states: Record<string, QuestionState>
  highlights: Record<string, Highlight[]>
  /** Seconds left in the current module (or elapsed, when untimed). */
  remaining: number | null
  elapsed: number
  breakRemaining: number
  timeUp: boolean
  fiveMinuteWarned: boolean
  /** Question opened from the results page. */
  reviewing: string | null

  loadSet(set: QuestionSet): void
  start(settings: TestSettings, onlyIds?: string[]): void
  answer(value: string | null): void
  toggleEliminate(letter: Letter): void
  toggleMark(): void
  check(): void
  goTo(index: number): void
  next(): void
  back(): void
  openReviewPage(): void
  tick(): void
  dismissTimeUp(): void
  endModule(): void
  tickBreak(): void
  endBreak(): void
  setHighlights(questionId: string, hs: Highlight[]): void
  setReviewing(id: string | null): void
  exit(): void
}

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      screen: 'home',
      set: null,
      setId: null,
      settings: DEFAULT_SETTINGS,
      modules: [],
      moduleIndex: 0,
      index: 0,
      onReviewPage: false,
      states: {},
      highlights: {},
      remaining: null,
      elapsed: 0,
      breakRemaining: BREAK_SECONDS,
      timeUp: false,
      fiveMinuteWarned: false,
      reviewing: null,

      loadSet: (qs) => set({ set: qs, setId: qs.id }),

      start: (settings, onlyIds) => {
        const qs = get().set
        if (!qs) return
        const pool = onlyIds ? qs.questions.filter((q) => onlyIds.includes(q.id)) : qs.questions
        const modules = buildModules(pool, settings)
        set({
          screen: 'test',
          settings,
          modules,
          moduleIndex: 0,
          index: 0,
          onReviewPage: false,
          states: Object.fromEntries(pool.map((q) => [q.id, blankState()])),
          highlights: {},
          remaining: modules[0]?.seconds ?? null,
          elapsed: 0,
          timeUp: false,
          fiveMinuteWarned: false,
          reviewing: null,
        })
      },

      answer: (value) =>
        updateCurrent(set, get, (s) => (s.checked ? s : { ...s, answer: value, eliminated: value ? s.eliminated.filter((l) => l !== value) : s.eliminated })),

      toggleEliminate: (letter) =>
        updateCurrent(set, get, (s) => {
          if (s.checked) return s
          const on = s.eliminated.includes(letter)
          return {
            ...s,
            eliminated: on ? s.eliminated.filter((l) => l !== letter) : [...s.eliminated, letter],
            // Crossing out the selected choice clears the selection, like Bluebook.
            answer: !on && s.answer === letter ? null : s.answer,
          }
        }),

      toggleMark: () => updateCurrent(set, get, (s) => ({ ...s, marked: !s.marked })),

      check: () => updateCurrent(set, get, (s) => ({ ...s, checked: true })),

      goTo: (index) => set({ index, onReviewPage: false }),

      next: () => {
        const { index, modules, moduleIndex, onReviewPage } = get()
        const n = modules[moduleIndex].questionIds.length
        if (onReviewPage) return get().endModule()
        if (index < n - 1) set({ index: index + 1 })
        else set({ onReviewPage: true })
      },

      back: () => {
        const { index, onReviewPage } = get()
        if (onReviewPage) set({ onReviewPage: false })
        else if (index > 0) set({ index: index - 1 })
      },

      openReviewPage: () => set({ onReviewPage: true }),

      tick: () => {
        const st = get()
        if (st.screen !== 'test' || st.timeUp) return
        const id = st.modules[st.moduleIndex]?.questionIds[st.index]
        const patch: Partial<State> = { elapsed: st.elapsed + 1 }
        if (id && !st.onReviewPage) {
          const qs = st.states[id] ?? blankState()
          patch.states = { ...st.states, [id]: { ...qs, timeSpent: qs.timeSpent + 1 } }
          if (st.settings.timingMode === 'perQuestion' && st.settings.autoAdvance && qs.timeSpent + 1 >= st.settings.secondsPerQuestion && !qs.checked) {
            const n = st.modules[st.moduleIndex].questionIds.length
            if (qs.timeSpent + 1 === st.settings.secondsPerQuestion) {
              if (st.index < n - 1) patch.index = st.index + 1
              else patch.onReviewPage = true
            }
          }
        }
        if (st.remaining !== null) {
          const r = st.remaining - 1
          patch.remaining = Math.max(0, r)
          if (r <= 0) patch.timeUp = true
        }
        set(patch)
      },

      dismissTimeUp: () => {
        set({ timeUp: false })
        get().endModule()
      },

      endModule: () => {
        const { moduleIndex, modules, settings } = get()
        const nextIdx = moduleIndex + 1
        if (nextIdx >= modules.length) {
          set({ screen: 'results', onReviewPage: false, timeUp: false })
          return
        }
        const sectionChange = modules[nextIdx].section !== modules[moduleIndex].section
        set({
          moduleIndex: nextIdx,
          index: 0,
          onReviewPage: false,
          remaining: modules[nextIdx].seconds,
          timeUp: false,
          fiveMinuteWarned: false,
          screen: sectionChange && settings.includeBreak ? 'break' : 'test',
          breakRemaining: BREAK_SECONDS,
        })
      },

      tickBreak: () => {
        const r = get().breakRemaining - 1
        if (r <= 0) get().endBreak()
        else set({ breakRemaining: r })
      },

      endBreak: () => set({ screen: 'test', breakRemaining: BREAK_SECONDS }),

      setHighlights: (questionId, hs) => set({ highlights: { ...get().highlights, [questionId]: hs } }),

      setReviewing: (id) => set({ reviewing: id }),

      exit: () => set({ screen: 'home', modules: [], states: {}, highlights: {}, reviewing: null, timeUp: false }),
    }),
    {
      name: 'blankbook-session',
      // The question set itself lives in IndexedDB; only progress goes to localStorage.
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
)

function updateCurrent(set: (p: Partial<State>) => void, get: () => State, fn: (s: QuestionState) => QuestionState) {
  const st = get()
  const id = st.modules[st.moduleIndex]?.questionIds[st.index]
  if (!id) return
  set({ states: { ...st.states, [id]: fn(st.states[id] ?? blankState()) } })
}

export function useCurrentModule() {
  return useApp((s) => s.modules[s.moduleIndex])
}

export function questionMap(set: QuestionSet | null): Map<string, Question> {
  return new Map((set?.questions ?? []).map((q) => [q.id, q]))
}

if (import.meta.env.DEV) (window as unknown as { __app: typeof useApp }).__app = useApp
