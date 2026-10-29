export type SectionKind = 'rw' | 'math'
export type Letter = 'A' | 'B' | 'C' | 'D'

/** A rendered slice of the original PDF. `w`/`h` are in PDF points so we can size it consistently. */
export interface Crop {
  src: string
  w: number
  h: number
  /** Figures are centered; text-like crops (math stems, choices) stay left-aligned. */
  align: 'left' | 'center'
}

/** Math glyphs cut from the PDF and set inline with the text. */
export interface InlineImage {
  src: string
  w: number
  h: number
  /** How far the image extends below the text baseline, in points. */
  drop: number
}

export interface Run {
  /** U+FFFC for inline images, so highlight offsets still count them as one character. */
  text: string
  italic?: boolean
  bold?: boolean
  script?: 'sup' | 'sub'
  img?: InlineImage
}

export interface Paragraph {
  id: string
  runs: Run[]
  /** Verse or a block quote: indented, with its line breaks kept. */
  indent?: boolean
}

export type Block =
  | { kind: 'text'; paragraphs: Paragraph[] }
  | { kind: 'image'; crop: Crop }

export interface Choice {
  letter: Letter
  blocks: Block[]
}

export interface Question {
  id: string
  section: SectionKind
  assessment: string
  test: string
  domain: string
  skill: string
  difficulty: string
  /** Left pane in Reading & Writing (passage, figures). Empty for math. */
  stimulus: Block[]
  /** The question itself (right pane in RW, the whole stem in math). */
  prompt: Block[]
  /** `null` means a student-produced response (grid-in). */
  choices: Choice[] | null
  /** Correct letter(s) for MCQ or accepted values for SPR; `null` if the PDF had no answers. */
  correct: string[] | null
  /** Image of the "Correct Answer" line, for SPR answers that contain math. */
  correctCrop?: Crop
  rationale: Block[]
}

export interface QuestionSet {
  id: string
  name: string
  createdAt: number
  questions: Question[]
}

export type TimingMode = 'bluebook' | 'total' | 'perQuestion' | 'untimed'
export type FeedbackMode = 'end' | 'immediate'

export interface TestSettings {
  timingMode: TimingMode
  /** Minutes for the whole test when timingMode === 'total'. */
  totalMinutes: number
  /** Seconds per question when timingMode === 'perQuestion'. */
  secondsPerQuestion: number
  /** In perQuestion mode, move on automatically when a question's time runs out. */
  autoAdvance: boolean
  feedback: FeedbackMode
  shuffle: boolean
  /** Split long sets into Bluebook-sized modules (27 RW / 22 Math). */
  splitModules: boolean
  /** Show a 10 minute break screen between Reading and Writing and Math. */
  includeBreak: boolean
}

export interface Module {
  section: SectionKind
  sectionNumber: number
  moduleNumber: number
  questionIds: string[]
  /** Seconds allowed; null when untimed. */
  seconds: number | null
}

export type HighlightColor = 'yellow' | 'blue' | 'pink'

export interface Highlight {
  id: string
  paragraphId: string
  start: number
  end: number
  color: HighlightColor
  underline: boolean
  note: string
}

export interface QuestionState {
  answer: string | null
  eliminated: Letter[]
  marked: boolean
  /** Locked after "Check" in immediate-feedback mode. */
  checked: boolean
  timeSpent: number
}
