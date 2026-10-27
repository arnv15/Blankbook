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
  const qIdx = L.findIndex((l, i) => i > headerIdx && l.text === 'Question')
  if (qIdx < 0) throw new ParseError(`Question ${id}: couldn't find the "Question" label.`)
  const labelFont = lineFont(L[qIdx])
  const isLabel = (l: Line, text: string) => l.text === text && lineFont(l) === labelFont
  const after = (pred: (l: Line) => boolean) => {
    const i = L.findIndex((l, j) => j > qIdx && pred(l))
    return i < 0 ? null : i
  }
  const aIdx = after((l) => isLabel(l, 'Answer'))
  const cIdx = after((l) => /^Correct Answer:/.test(l.text))
  const rIdx = after((l) => isLabel(l, 'Rationale'))

  const meta = parseMeta(L, headerIdx, qIdx)
  const section: SectionKind = /math/i.test(meta.test) ? 'math' : 'rw'

  const right = (p: number) => pages[p].width - left
  const stemEndIdx = firstOf(aIdx, cIdx, rIdx)
  const stem = between(L, L[qIdx], stemEndIdx === null ? null : L[stemEndIdx], left, right, pages)

  // Choices: "A."…"D." labels flush with the left margin, in order.
  let choices: ChoiceSkeleton[] | null = null
  const choiceFrom = aIdx ?? stemEndIdx
  if (choiceFrom !== null) {
    const choiceEnd = firstOf(cIdx, rIdx)
    const labelIdxs: number[] = []
    for (let i = choiceFrom; i < (choiceEnd ?? L.length); i++) {
      const m = CHOICE_RE.exec(L[i].text)
      if (m && m[1] === LETTERS[labelIdxs.length] && L[i].x0 - margin < 4) labelIdxs.push(i)
    }
    if (labelIdxs.length >= 2) {
      choices = labelIdxs.map((li, k) => {
        const label = L[li]
        const prevBottom = k === 0 ? L[choiceFrom].bottom : null
        const nextIdx = k + 1 < labelIdxs.length ? labelIdxs[k + 1] : choiceEnd
        const startY = prevBottom ?? midGap(L, li)
        const endY = nextIdx === null ? null : k + 1 < labelIdxs.length ? midGap(L, nextIdx) : L[nextIdx].top - 1
        const segs = segmentsFor(L, label.page, startY, nextIdx === null ? L[L.length - 1].page : L[nextIdx].page, endY, left, right, pages)
        return { letter: LETTERS[k], segments: segs, contentLeft: labelEnd(label) + 2 }
      })
    }
  }

  let correctText: string | null = null
  let correctLine: Line | null = null
  if (cIdx !== null) {
    correctLine = L[cIdx]
    correctText = L[cIdx].text.replace(/^Correct Answer:\s*/, '').trim()
  }

  const rationale =
    rIdx === null ? [] : between(L, L[rIdx], null, left, right, pages)

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
  for (const it of L[headerIdx].items) {
    if (it.isSpace) flush()
    else word.push(it)
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
