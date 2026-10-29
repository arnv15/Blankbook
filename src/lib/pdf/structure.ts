// Text-only pass: finds each question's anchors (labels, choices, answer, rationale)
// and describes the page regions that the raster pass will analyze and crop.
import type { Letter, SectionKind } from '../types'
import { joinItems, type Line, type TItem } from './lines'

export interface PageInfo {
  width: number
  height: number
}

/** A vertical slice of one page, in top-down points. */
export interface Segment {
  page: number
  top: number
  bottom: number
  left: number
  right: number
  lines: Line[]
}

export interface ChoiceSkeleton {
  letter: Letter
  segments: Segment[]
  /** Where the content starts once the "A." label is removed. */
  contentLeft: number
}

export interface QuestionSkeleton {
  id: string
  section: SectionKind
  meta: { assessment: string; test: string; domain: string; skill: string; difficulty: string }
  regularFont: string | null
  stem: Segment[]
  choices: ChoiceSkeleton[] | null
  correctText: string | null
  correctLine: Line | null
  rationale: Segment[]
}

const ID_RE = /^Question ID:?\s*([0-9a-f]{6,10})\b/i
const CHOICE_RE = /^([A-D])\.(\s|$)/
const LETTERS: Letter[] = ['A', 'B', 'C', 'D']
const PAGE_PAD = 8

export class ParseError extends Error {}

export function buildSkeletons(lines: Line[], pages: PageInfo[]): QuestionSkeleton[] {
  const starts = lines.flatMap((l, i) => (ID_RE.test(l.text) ? [i] : []))
  if (starts.length === 0) {
    throw new ParseError(
      'No "Question ID" headers found. Export from the SAT Suite Question Bank with "With correct answers and explanations" (or "No correct answers or explanations").',
    )
  }
  return starts.map((start, n) => {
    const end = n + 1 < starts.length ? starts[n + 1] : lines.length
    return buildOne(lines.slice(start, end), pages)
  })
}

function domFont(lines: Line[]): string | null {
  const counts = new Map<string, number>()
  for (const l of lines) for (const it of l.items) if (!it.isSpace) counts.set(it.font, (counts.get(it.font) ?? 0) + it.str.length)
  let best: string | null = null
  let max = 0
  for (const [f, c] of counts) if (c > max) [best, max] = [f, c]
  return best
}

function lineFont(l: Line): string | null {
  return domFont([l])
}

function buildOne(L: Line[], pages: PageInfo[]): QuestionSkeleton {
  const id = ID_RE.exec(L[0].text)![1].toLowerCase()
  const margin = Math.min(...L.map((l) => l.x0))
  const left = Math.max(0, margin - 3)

  const headerIdx = L.findIndex((l) => /Assessment/.test(l.text) && /Difficulty/.test(l.text))
  // Two export layouts exist: one labels the stem "Question" and the choices "Answer";
  // the other opens the stem with "ID: <id>" and closes the choices with "ID: <id> Answer".
  const idLine = new RegExp(`^ID:?\\s*${id}$`, 'i')
  const idAnswerLine = new RegExp(`^ID:?\\s*${id}\\s+Answer$`, 'i')
  const qIdx = L.findIndex((l, i) => i > headerIdx && (l.text === 'Question' || idLine.test(l.text)))
  if (qIdx < 0) throw new ParseError(`Question ${id}: couldn't find where the question starts.`)
  const labelFont = L[qIdx].text === 'Question' ? lineFont(L[qIdx]) : null
  const isLabel = (l: Line, text: string) => l.text === text && (labelFont === null || lineFont(l) === labelFont)
  const after = (pred: (l: Line) => boolean) => {
    const i = L.findIndex((l, j) => j > qIdx && pred(l))
    return i < 0 ? null : i
  }
  const aIdx = after((l) => isLabel(l, 'Answer'))
  const markerIdx = after((l) => idAnswerLine.test(l.text))
  const cIdx = after((l) => /^Correct Answer:/.test(l.text))
  const rIdx = after((l) => isLabel(l, 'Rationale'))
  const diffIdx = after((l) => /^Question Difficulty:/.test(l.text))

  const meta = parseMeta(L, headerIdx, qIdx)
  if (!meta.difficulty && diffIdx !== null) meta.difficulty = L[diffIdx].text.replace(/^Question Difficulty:\s*/, '').trim()
  const section: SectionKind = /math/i.test(meta.test) ? 'math' : 'rw'
  const right = (p: number) => pages[p].width - left

  // Choices: "A."…"D." labels near the left margin, in order.
  const choicesEnd = firstOf(markerIdx, cIdx, rIdx)
  // Measure the margin from the body, not the title (which can sit further left).
  const bodyMargin = Math.min(...L.slice(qIdx + 1).map((l) => l.x0))
  const labelIdxs: number[] = []
  for (let i = (aIdx ?? qIdx) + 1; i < (choicesEnd ?? L.length); i++) {
    const m = CHOICE_RE.exec(L[i].text)
    if (m && m[1] === LETTERS[labelIdxs.length] && L[i].x0 - bodyMargin < 8) labelIdxs.push(i)
  }
  const hasChoices = labelIdxs.length >= 2

  const stemEndIdx = aIdx ?? (hasChoices ? labelIdxs[0] : choicesEnd)
  // The "ID: …" labels are white text in a filled box that overhangs the text; stay clear of it.
  const boxPad = (l: Line) => (idLine.test(l.text) || idAnswerLine.test(l.text) ? l.size * 0.8 : 0)
  const stemFrom = L[qIdx]
  const stemTo = stemEndIdx === null ? null : L[stemEndIdx]
  const stem = segmentsFor(
    L,
    stemFrom.page,
    stemFrom.bottom + 1 + boxPad(stemFrom),
    stemTo ? stemTo.page : L[L.length - 1].page,
    stemTo ? (hasChoices && stemEndIdx === labelIdxs[0] ? midGap(L, stemEndIdx) : stemTo.top - 1 - boxPad(stemTo)) : null,
    left,
    right,
    pages,
  )

  let choices: ChoiceSkeleton[] | null = null
  if (hasChoices) {
    choices = labelIdxs.map((li, k) => {
      const label = L[li]
      const startY = k === 0 && aIdx !== null ? L[aIdx].bottom : midGap(L, li)
      const nextIdx = k + 1 < labelIdxs.length ? labelIdxs[k + 1] : choicesEnd
      const endY = nextIdx === null ? null : k + 1 < labelIdxs.length ? midGap(L, nextIdx) : L[nextIdx].top - 1 - boxPad(L[nextIdx])
      const startPage = k === 0 && aIdx !== null ? L[aIdx].page : label.page
      const segs = segmentsFor(L, startPage, startY, nextIdx === null ? L[L.length - 1].page : L[nextIdx].page, endY, left, right, pages)
      return { letter: LETTERS[k], segments: segs, contentLeft: labelEnd(label) + 2 }
    })
  }

  let correctText: string | null = null
  let correctLine: Line | null = null
  if (cIdx !== null) {
    correctLine = L[cIdx]
    correctText = L[cIdx].text.replace(/^Correct Answer:\s*/, '').trim()
  }

  const rationale = rIdx === null ? [] : between(L, L[rIdx], diffIdx === null ? null : L[diffIdx], left, right, pages)

  return {
    id,
    section,
    meta,
    regularFont: domFont(stem.flatMap((s) => s.lines)),
    stem,
    choices,
    correctText,
    correctLine,
    rationale,
  }
}

/**
 * Where a choice's content starts once its "A." label is removed. The label may be
 * one item ("A."), split ("D" + "."), or glued to the first word ("A.Coll").
 */
export function labelEnd(line: Line): number {
  let acc = ''
  for (const it of line.items) {
    if (it.isSpace) continue
    const before = acc.length
    acc += it.str
    if (/^[A-D]\./.test(acc)) {
      const inThisItem = 2 - before
      return it.x + (it.w * inThisItem) / it.str.length
    }
    if (acc.length >= 2) break
  }
  return line.x0 + line.size
}

function firstOf(...xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null)
  return v.length ? Math.min(...v) : null
}

/** Halfway between line i and whatever is above it, so tall math above the baseline isn't clipped. */
function midGap(L: Line[], i: number): number {
  const prev = L[i - 1]
  if (!prev || prev.page !== L[i].page) return L[i].top - 4
  return (prev.bottom + L[i].top) / 2
}

/** Region strictly after `from` and before `to` (or to the end of the question). */
function between(
  L: Line[],
  from: Line,
  to: Line | null,
  left: number,
  right: (p: number) => number,
  pages: PageInfo[],
): Segment[] {
  const endPage = to ? to.page : L[L.length - 1].page
  return segmentsFor(L, from.page, from.bottom + 1, endPage, to ? to.top - 1 : null, left, right, pages)
}

function segmentsFor(
  L: Line[],
  startPage: number,
  startY: number,
  endPage: number,
  endY: number | null,
  left: number,
  right: (p: number) => number,
  pages: PageInfo[],
): Segment[] {
  const segs: Segment[] = []
  for (let p = startPage; p <= endPage; p++) {
    const top = p === startPage ? startY : PAGE_PAD
    const bottom = p === endPage && endY !== null ? endY : pages[p].height - PAGE_PAD
    if (bottom - top < 2) continue
    const lines = L.filter((l) => l.page === p && l.baseline > top && l.baseline < bottom)
    segs.push({ page: p, top, bottom, left, right: right(p), lines })
  }
  return segs
}

function parseMeta(L: Line[], headerIdx: number, qIdx: number) {
  const empty = { assessment: '', test: '', domain: '', skill: '', difficulty: '' }
  if (headerIdx < 0) return empty
  // Column x positions come from the header words.
  const cols: { name: string; x: number }[] = []
  let word: TItem[] = []
  const flush = () => {
    if (word.length) cols.push({ name: joinItems(word).toLowerCase(), x: word[0].x })
    word = []
  }
  // Columns are split by space items or, in exports without them, by a wide gap.
  for (const it of L[headerIdx].items) {
    if (it.isSpace) flush()
    else {
      const prev = word[word.length - 1]
      if (prev && it.x - (prev.x + prev.w) > it.size * 1.5) flush()
      word.push(it)
    }
  }
  flush()

  const cells = new Map<string, string[]>()
  for (const line of L.slice(headerIdx + 1, qIdx)) {
    const byCol = new Map<string, TItem[]>()
    for (const it of line.items) {
      const col = cols.findLast((c) => c.x <= it.x + 4)
      if (!col) continue
      byCol.set(col.name, [...(byCol.get(col.name) ?? []), it])
    }
    for (const [name, items] of byCol) {
      const t = joinItems(items)
      if (t) cells.set(name, [...(cells.get(name) ?? []), t])
    }
  }
  const get = (name: string) => (cells.get(name) ?? []).join(' ').trim()
  return {
    assessment: get('assessment'),
    test: get('test'),
    domain: get('domain'),
    skill: get('skill'),
    difficulty: get('difficulty'),
  }
}
