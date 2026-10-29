import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Block, Choice, Crop, InlineImage, Paragraph, Question, Run, SectionKind } from '../types'
import { groupLines, isWordPerItem, toItems, type Line, type RawItem, type TItem } from './lines'
import { buildSkeletons, ParseError, type PageInfo, type QuestionSkeleton, type Segment } from './structure'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { ParseError }

/** Render scale. Content is shown at ~1.85 CSS px per point, so 4x stays sharp on retina screens. */
const RS = 4
const DARK = 150
const INK_ROW_MIN = 3
const BAND_GAP_PT = 6
const OBJ = '￼'

export async function parseQuestionBankPdf(
  data: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<Question[]> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data), verbosity: 0 })
  const doc = await task.promise
  try {
    const pages: PageInfo[] = []
    const raws: { items: RawItem[]; top: number; left: number }[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const [x0, y0, x1, y1] = page.view
      pages.push({ width: x1 - x0, height: y1 - y0 })
      const tc = await page.getTextContent()
      raws.push({ items: tc.items.flatMap((i) => ('str' in i ? [i] : [])), top: y1, left: x0 })
    }
    const wordPerItem = isWordPerItem(raws.flatMap((r) => r.items))
    const lines = raws.flatMap((r, p) => groupLines(toItems(r.items, r.top, r.left, wordPerItem), p))
    const skeletons = buildSkeletons(lines, pages)

    // Raster pass, one page at a time so only one big canvas is alive.
    const work = new Map<number, (ctx: PageRaster) => void>()
    const results = skeletons.map((s) => planQuestion(s, work))
    const total = doc.numPages
    for (let p = 0; p < total; p++) {
      const job = work.get(p)
      if (job) {
        const raster = await renderPage(
          await doc.getPage(p + 1),
          lines.filter((l) => l.page === p),
        )
        job(raster)
        raster.release()
      }
      onProgress?.(p + 1, total)
    }
    return results.map((r) => r())
  } finally {
    await task.destroy()
  }
}

// ---------- page raster ----------

interface PageRaster {
  canvas: HTMLCanvasElement
  width: number
  height: number
  /** Grayscale luminance, row-major, at RS. */
  lum: Uint8Array
  /** 1 where a text glyph is drawn. Whatever is dark and unmasked is math, rules or figures. */
  textMask: Uint8Array
  release(): void
}

async function renderPage(page: pdfjs.PDFPageProxy, pageLines: Line[]): Promise<PageRaster> {
  const viewport = page.getViewport({ scale: RS })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // 'print' intent: the default 'display' intent paces itself with requestAnimationFrame,
  // which stalls in background tabs (switching tabs mid-upload would hang the parse).
  await page.render({ canvas, canvasContext: ctx, viewport, intent: 'print', annotationMode: pdfjs.AnnotationMode.DISABLE }).promise
  const W = canvas.width
  const H = canvas.height
  const rgba = ctx.getImageData(0, 0, W, H).data
  const lum = new Uint8Array(W * H)
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000

  const textMask = new Uint8Array(W * H)
  for (const line of pageLines) {
    for (const it of line.items) {
      if (it.isSpace) continue
      const x0 = clamp(Math.floor((it.x - 0.8) * RS), 0, W)
      const x1 = clamp(Math.ceil((it.x + it.w + 0.8) * RS), 0, W)
      const y0 = clamp(Math.floor((it.y - it.size * 1.0) * RS), 0, H)
      const y1 = clamp(Math.ceil((it.y + it.size * 0.32) * RS), 0, H)
      for (let y = y0; y < y1; y++) textMask.fill(1, y * W + x0, y * W + Math.max(x0, x1))
    }
  }
  return {
    canvas,
    width: W,
    height: H,
    lum,
    textMask,
    release() {
      canvas.width = canvas.height = 0
    },
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const isInk = (r: PageRaster, i: number) => r.lum[i] < DARK && !r.textMask[i]

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

/** Non-text ink per pixel row (rows in RS pixels, starting at rect.top), plus the longest unbroken run. */
function rowInk(r: PageRaster, rect: Rect): { y0: number; counts: Int32Array; runs: Int32Array } {
  const x0 = clamp(Math.floor(rect.left * RS), 0, r.width)
  const x1 = clamp(Math.ceil(rect.right * RS), 0, r.width)
  const y0 = clamp(Math.floor(rect.top * RS), 0, r.height)
  const y1 = clamp(Math.ceil(rect.bottom * RS), 0, r.height)
  const counts = new Int32Array(Math.max(0, y1 - y0))
  const runs = new Int32Array(Math.max(0, y1 - y0))
  for (let y = y0; y < y1; y++) {
    let c = 0
    let run = 0
    let best = 0
    const base = y * r.width
    for (let x = x0; x < x1; x++) {
      if (isInk(r, base + x)) {
        c++
        if (++run > best) best = run
      } else run = 0
    }
    counts[y - y0] = c
    runs[y - y0] = best
  }
  return { y0, counts, runs }
}

// ---------- cropping ----------

function toDataUrl(r: PageRaster, x0: number, y0: number, w: number, h: number): string {
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(r.canvas, x0, y0, w, h, 0, 0, w, h)
  const src = out.toDataURL('image/png')
  out.width = out.height = 0
  return src
}

/** Crops a rect and trims surrounding whitespace. Left-aligned crops keep their left edge. */
function crop(r: PageRaster, rect: Rect, align: Crop['align']): Crop | null {
  let x0 = clamp(Math.floor(rect.left * RS), 0, r.width)
  let x1 = clamp(Math.ceil(rect.right * RS), 0, r.width)
  let y0 = clamp(Math.floor(rect.top * RS), 0, r.height)
  let y1 = clamp(Math.ceil(rect.bottom * RS), 0, r.height)
  let minX = x1, maxX = -1, minY = y1, maxY = -1
  // Figures can sit in a faint grey container box; trim to real ink so the figure isn't shrunk.
  const inkLevel = align === 'center' ? 200 : 235
  for (let y = y0; y < y1; y++) {
    const base = y * r.width
    for (let x = x0; x < x1; x++) {
      if (r.lum[base + x] < inkLevel) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const pad = 2 * RS
  if (align === 'center') x0 = Math.max(x0, minX - pad)
  x1 = Math.min(x1, maxX + pad + 1)
  y0 = Math.max(y0, minY - pad)
  y1 = Math.min(y1, maxY + pad + 1)
  return { src: toDataUrl(r, x0, y0, x1 - x0, y1 - y0), w: (x1 - x0) / RS, h: (y1 - y0) / RS, align }
}

// ---------- region analysis ----------

interface Ctx {
  qid: string
  section: SectionKind
  regularFont: string | null
  counter: { n: number }
}

/**
 * Turns a region of the page into blocks:
 *  - text lines become paragraphs, with inline math cut out as small images;
 *  - ink that isn't on a text line (charts, tables, display equations) becomes a figure image,
 *    together with the labels that sit inside or right next to it.
 */
/**
 * Thin vertical bars (a blockquote's accent bar, table column borders) are never text or
 * inline math. Mask them so they don't turn into stray inline images; crops still show them.
 */
function maskVerticalBars(r: PageRaster, rect: Rect, minLenPt: number) {
  const x0 = clamp(Math.floor(rect.left * RS), 0, r.width)
  const x1 = clamp(Math.ceil(rect.right * RS), 0, r.width)
  const y0 = clamp(Math.floor(rect.top * RS), 0, r.height)
  const y1 = clamp(Math.ceil(rect.bottom * RS), 0, r.height)
  const minLen = minLenPt * RS
  for (let x = x0; x < x1; x++) {
    let start = -1
    for (let y = y0; y <= y1; y++) {
      const ink = y < y1 && isInk(r, y * r.width + x)
      if (ink && start < 0) start = y
      if (!ink && start >= 0) {
        if (y - start >= minLen) for (let k = start; k < y; k++) r.textMask[k * r.width + x] = 1
        start = -1
      }
    }
  }
}

/** Where a line's own text starts inside the region (a stripped "A." label doesn't count). */
function textX0(l: Line, rect: Rect): number {
  const first = l.items.find((i) => !i.isSpace && i.x >= rect.left - 1)
  return first ? first.x : l.x0
}

/**
 * Turns a region of the page into blocks:
 *  - text lines become paragraphs, with inline math cut out as small images;
 *  - ink that isn't on a text line (charts, tables, display equations) becomes a figure image,
 *    together with the labels and captions that sit inside or right next to it.
 */
function analyzeRegion(r: PageRaster, rect: Rect, lines: Line[], ctx: Ctx): Block[] {
  const sorted = [...lines].sort((a, b) => a.baseline - b.baseline)
  const size = sorted.length ? Math.min(...sorted.map((l) => l.size)) : 10
  const zone = (l: Line, ext: number) => ({ top: l.top - l.size * (0.15 + ext), bottom: l.bottom + l.size * (0.05 + ext) })
  maskVerticalBars(r, rect, size * 2.5)

  // 1. Bands of non-text ink.
  const { y0, counts, runs } = rowInk(r, rect)
  const raw: { top: number; bottom: number; ink: number; offLine: number; rule: boolean }[] = []
  // Long horizontal rules are box edges or table borders, never inline math. Fraction bars
  // sit inside a text line, so a shorter rule only counts when it lies between lines.
  const longRule = (rect.right - rect.left) * RS * 0.25
  const shortRule = 40 * RS
  const gap = BAND_GAP_PT * RS
  const inZone = (yPt: number, ext: number) =>
    sorted.some((l) => {
      const z = zone(l, ext)
      return yPt >= z.top && yPt <= z.bottom
    })
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] < INK_ROW_MIN) continue
    const yPt = (y0 + i) / RS
    const off = inZone(yPt, 0.7) ? 0 : 1
    const rule = runs[i] > longRule || (runs[i] > shortRule && !inZone(yPt, 0))
    const last = raw[raw.length - 1]
    if (last && i - last.bottom <= gap) {
      last.bottom = i
      last.ink += counts[i]
      last.offLine += off
      last.rule ||= rule
    } else raw.push({ top: i, bottom: i, ink: counts[i], offLine: off, rule })
  }
  // A band is a figure when a real chunk of it lies away from every text line (or it has
  // rules); otherwise it's inline math, including fraction parts poking above/below a line.
  const figures = raw
    .filter((b) => b.ink > 40 && (b.offLine / RS >= 3 || b.rule))
    .map((b) => ({ top: (b.top + y0) / RS, bottom: (b.bottom + y0 + 1) / RS }))

  // 2. Which lines belong to a figure.
  const xs = sorted.map((l) => textX0(l, rect)).filter(Number.isFinite)
  const margin = xs.length ? Math.min(...xs) : rect.left
  const width = rect.right - rect.left
  const inFig = sorted.map((l) => figures.some((f) => l.top < f.bottom && l.bottom > f.top))
  for (let changed = true; changed; ) {
    changed = false
    sorted.forEach((l, i) => {
      if (inFig[i]) return
      const reach = l.size * 3.2
      const near =
        sorted.some((o, j) => inFig[j] && Math.abs(o.baseline - l.baseline) < reach) ||
        figures.some((f) => l.top < f.bottom + reach && l.bottom > f.top - reach)
      if (!near) return
      // Titles, legends and axis labels: not flush-left, or a short caption with no end punctuation.
      const indented = textX0(l, rect) - margin >= 6
      const caption = l.x1 - l.x0 < width * 0.6 && !/[.?!:;,"”_]$/.test(l.text)
      // Table rows: a line with a rule just above and just below it.
      const hug = l.size * 1.2
      const sandwiched =
        figures.some((f) => f.bottom <= l.top + 1 && l.top - f.bottom < hug) &&
        figures.some((f) => f.top >= l.bottom - 1 && f.top - l.bottom < hug)
      if (indented || caption || sandwiched) inFig[i] = changed = true
    })
  }

  // 3. Walk top to bottom, emitting paragraphs and figures in reading order.
  type Item = { top: number; bottom: number; line?: Line; fig: boolean }
  const items: Item[] = [
    ...sorted.map((l, i) => ({ top: l.top, bottom: l.bottom, line: l, fig: inFig[i] })),
    ...figures.map((f) => ({ ...f, fig: true })),
  ].sort((a, b) => a.top - b.top)

  const textLines = sorted.filter((_, i) => !inFig[i])
  const out: Block[] = []
  let para: Line[] = []
  let fig: { top: number; bottom: number } | null = null
  const flushText = () => {
    if (para.length) {
      const paragraphs = linesToParagraphs(r, rect, para, textLines, ctx)
      if (paragraphs.length) out.push({ kind: 'text', paragraphs })
    }
    para = []
  }
  const flushFig = () => {
    if (fig) {
      const c = crop(r, { left: rect.left, right: rect.right, top: fig.top - 3, bottom: fig.bottom + 3 }, 'center')
      if (c) out.push({ kind: 'image', crop: c })
    }
    fig = null
  }
  for (const it of items) {
    if (it.fig) {
      flushText()
      fig = fig ? { top: Math.min(fig.top, it.top), bottom: Math.max(fig.bottom, it.bottom) } : { top: it.top, bottom: it.bottom }
    } else if (fig && it.top < fig.bottom) {
      fig.bottom = Math.max(fig.bottom, it.bottom)
    } else {
      flushFig()
      para.push(it.line!)
    }
  }
  flushFig()
  flushText()
  return out
}

// ---------- text with inline math ----------

type Piece = { kind: 'text'; it: TItem } | { kind: 'space' } | { kind: 'img'; x0: number; x1: number; img: InlineImage }

/** Finds math glyph clusters on a line and cuts each into an inline image. */
function inlineMath(r: PageRaster, rect: Rect, line: Line, prev: Line | undefined, next: Line | undefined): { x0: number; x1: number; img: InlineImage }[] {
  const s = line.size
  const coreTop = Math.floor((line.top - s * 0.1) * RS)
  const coreBottom = Math.ceil((line.bottom + s * 0.05) * RS)
  const x0 = clamp(Math.floor(rect.left * RS), 0, r.width)
  const x1 = clamp(Math.ceil(rect.right * RS), 0, r.width)
  const cols = new Int32Array(x1 - x0)
  for (let y = Math.max(0, coreTop); y < Math.min(r.height, coreBottom); y++) {
    const base = y * r.width
    for (let x = x0; x < x1; x++) if (isInk(r, base + x)) cols[x - x0]++
  }
  // Group ink columns into clusters (MathJax letters in one expression sit close together).
  const clusters: { a: number; b: number; ink: number }[] = []
  const join = Math.round(1.6 * RS)
  for (let i = 0; i < cols.length; i++) {
    if (cols[i] < 2) continue
    const last = clusters[clusters.length - 1]
    if (last && i - last.b <= join) {
      last.b = i
      last.ink += cols[i]
    } else clusters.push({ a: i, b: i, ink: cols[i] })
  }
  // Vertical window: halfway to the neighbouring lines, so tall fractions aren't clipped.
  const winTop = Math.floor((prev ? (prev.bottom + line.top) / 2 : line.top - s * 0.9) * RS)
  const winBottom = Math.ceil((next ? (line.bottom + next.top) / 2 : line.bottom + s * 0.9) * RS)

  return clusters
    .filter((c) => c.ink >= 12)
    .map((c) => {
      const ax = x0 + c.a
      const bx = x0 + c.b + 1
      let minY = Infinity
      let maxY = -Infinity
      for (let y = Math.max(0, winTop); y < Math.min(r.height, winBottom); y++) {
        const base = y * r.width
        for (let x = ax; x < bx; x++) {
          if (isInk(r, base + x)) {
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            break
          }
        }
      }
      const pad = RS
      // Keep the box at least from cap height to baseline so short glyphs align like text.
      const top = Math.min(minY - pad, Math.floor((line.baseline - s * 0.75) * RS))
      const bottom = Math.max(maxY + pad + 1, Math.ceil(line.baseline * RS) + 1)
      const left = ax - pad
      const right = bx + pad
      return {
        x0: left / RS,
        x1: right / RS,
        img: {
          src: toDataUrl(r, left, top, right - left, bottom - top),
          w: (right - left) / RS,
          h: (bottom - top) / RS,
          drop: bottom / RS - line.baseline,
        },
      }
    })
}

/**
 * Merges text items and math images in x order. pdf.js reports one wide space item
 * across "where E is" (the math sits inside it), so spaces next to math are derived
 * from how much of that space item sticks out on either side of the image.
 */
function linePieces(r: PageRaster, rect: Rect, line: Line, prev: Line | undefined, next: Line | undefined): Piece[] {
  const maths = inlineMath(r, rect, line, prev, next)
  const items = line.items.filter((it) => it.x >= rect.left - 1)
  const pieces: (Piece & { x: number })[] = []
  items.forEach((it, k) => {
    if (!it.isSpace) {
      pieces.push({ kind: 'text', it, x: it.x })
      return
    }
    // Real-font exports reserve a space item under each superscript ("(␣⁸⁷Sr/␣⁸⁶Sr)"); keep
    // only the part of it that sticks out past the script.
    const scripts = items.filter((i) => i.script && i.x < it.x + it.w && i.x + i.w > it.x)
    if (scripts.length > 0) {
      const thr = line.size * 0.15
      if (scripts[0].x - it.x > thr) pieces.push({ kind: 'space', x: it.x })
      const end = Math.max(...scripts.map((i) => i.x + i.w))
      // These space items can run into the next glyph, so measure only up to it.
      const nextGlyph = items.slice(k + 1).find((i) => !i.isSpace && !i.script)
      const spaceEnd = Math.min(it.x + it.w, nextGlyph ? nextGlyph.x : Infinity)
      if (spaceEnd - end > thr) pieces.push({ kind: 'space', x: end })
      return
    }
    const inside = maths.filter((m) => m.x1 > it.x && m.x0 < it.x + it.w)
    if (inside.length === 0) {
      pieces.push({ kind: 'space', x: it.x })
      return
    }
    // The space item swallowed "␣math␣". Glyph overhang makes gaps unreliable, so use the
    // neighbouring characters: no space after an opener, none before closing punctuation.
    const before = items.slice(0, k).findLast((i) => !i.isSpace)?.str ?? ''
    const after = items.slice(k + 1).find((i) => !i.isSpace)?.str ?? ''
    if (before && !/[([{“‘$/-]$/.test(before)) pieces.push({ kind: 'space', x: it.x })
    if (after && !/^[.,;:!?)\]}”’%-]/.test(after)) pieces.push({ kind: 'space', x: inside[inside.length - 1].x1 })
  })
  for (const m of maths) pieces.push({ kind: 'img', x0: m.x0, x1: m.x1, img: m.img, x: m.x0 })
  return pieces.sort((a, b) => a.x - b.x)
}

function linesToParagraphs(r: PageRaster, rect: Rect, lines: Line[], allText: Line[], ctx: Ctx): Paragraph[] {
  if (lines.length === 0) return []
  const spacings = allText.slice(1).map((l, i) => l.baseline - allText[i].baseline).filter((d) => d > 2)
  const typical = spacings.length ? Math.min(...spacings) : lines[0].size * 1.6
  // Verse and block quotes are indented in Reading and Writing passages; keep their line breaks.
  // (Math lines can start with an image, which makes text look indented, so only RW.)
  const margin = Math.min(...allText.map((l) => textX0(l, rect)))
  const indented = (l: Line) => ctx.section === 'rw' && textX0(l, rect) - margin >= 10
  const paras: Line[][] = []
  lines.forEach((l, i) => {
    const prev = lines[i - 1]
    const newPara =
      !prev ||
      prev.page !== l.page ||
      l.baseline - prev.baseline > typical * 1.5 ||
      /^[•●▪]/.test(l.text) ||
      indented(l) !== indented(prev)
    if (newPara) paras.push([l])
    else paras[paras.length - 1].push(l)
  })
  return paras
    .map((pl) => {
      const verse = pl.length > 1 && pl.every(indented)
      return {
        id: `${ctx.qid}-p${ctx.counter.n++}`,
        ...(verse ? { indent: true } : {}),
        runs: lineRuns(
          pl,
          (l) => {
            const k = allText.indexOf(l)
            return linePieces(r, rect, l, allText[k - 1], allText[k + 1])
          },
          ctx.regularFont,
          (it, l) => looksItalic(r, it, l.size),
          verse ? '\n' : ' ',
        ),
      }
    })
    .filter((p) => p.runs.length > 0)
}

function lineRuns(
  lines: Line[],
  piecesOf: (l: Line) => Piece[],
  regularFont: string | null,
  italic: (it: TItem, line: Line) => boolean,
  lineJoin: ' ' | '\n' = ' ',
): Run[] {
  const runs: Run[] = []
  const push = (text: string, style: Omit<Run, 'text'> = {}) => {
    const last = runs[runs.length - 1]
    if (!style.img && last && !last.img && !!last.italic === !!style.italic && !!last.bold === !!style.bold && last.script === style.script) last.text += text
    else runs.push({ text, ...style })
  }
  lines.forEach((line, li) => {
    const pieces = piecesOf(line)
    const glyphs = line.items.filter((i) => !i.isSpace)
    // A short line entirely in another font is a heading ("Text 1"); off-font words may be italic.
    const heading = regularFont !== null && glyphs.length > 0 && glyphs.every((g) => g.font !== regularFont) && line.text.length < 40 && pieces.every((p) => p.kind !== 'img')
    let prevEnd = -Infinity
    let prevKind: Piece['kind'] | null = null
    let prevText = ''
    let prevScript = false
    for (const p of pieces) {
      if (p.kind === 'space') {
        push(' ')
      } else if (p.kind === 'img') {
        // No space item before it (e.g. math right after the last word on a line): use the gap.
        if (prevKind === 'text' && !/[([{“‘$/-]$/.test(prevText) && p.x0 - prevEnd > line.size * 0.08) push(' ')
        push(OBJ, { img: p.img })
        prevEnd = p.x1
      } else {
        const it = p.it
        if (prevKind === 'text' && !it.script && !prevScript && it.x - prevEnd > it.size * 0.2) push(' ')
        // Math at the start of a wrapped line has no space item after it; overhang keeps real
        // touching pairs under ~1pt, so a clear gap before a word means a space.
        if (prevKind === 'img' && /^[A-Za-z0-9]/.test(it.str) && it.x - prevEnd > it.size * 0.08) push(' ')
        const style: Omit<Run, 'text'> = heading
          ? { bold: true }
          : { italic: regularFont !== null && it.font !== regularFont && /[A-Za-z].*[A-Za-z]/.test(it.str) && italic(it, line) }
        if (it.script) style.script = it.script
        push(it.str, style)
        prevEnd = it.x + it.w
        prevText = it.str
        prevScript = !!it.script
      }
      prevKind = p.kind
    }
    if (li < lines.length - 1) {
      if (lineJoin === '\n') push('\n')
      else if (!/[—-]$/.test(line.text)) push(' ')
    }
  })
  // Collapse whitespace.
  const cleaned = runs
    .map((r) => (r.img ? r : { ...r, text: r.text.replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n') }))
    .filter((r) => r.text.length > 0)
  if (cleaned[0] && !cleaned[0].img) cleaned[0] = { ...cleaned[0], text: cleaned[0].text.trimStart() }
  const last = cleaned.length - 1
  if (cleaned[last] && !cleaned[last].img) cleaned[last] = { ...cleaned[last], text: cleaned[last].text.trimEnd() }
  return cleaned.filter((r) => r.text.length > 0)
}

/** Drops the leading "A." (which may span items, e.g. "D" + ".") from a choice's first line. */
function stripLabel(lines: Line[]): Line[] {
  if (lines.length === 0) return lines
  const [first, ...rest] = [...lines].sort((a, b) => a.baseline - b.baseline)
  const items = [...first.items]
  let toDrop = 2
  while (toDrop > 0 && items.length) {
    const it = items[0]
    if (it.isSpace) {
      items.shift()
      continue
    }
    if (it.str.length <= toDrop) {
      toDrop -= it.str.length
      items.shift()
    } else {
      items[0] = { ...it, str: it.str.slice(toDrop).trimStart() }
      toDrop = 0
    }
  }
  while (items[0]?.isSpace) items.shift()
  return [{ ...first, items }, ...rest]
}

/**
 * Italic test from pixels: shear the glyphs and see whether vertical strokes get
 * sharper. Font IDs can't tell us (exports split one typeface across many fonts).
 */
function looksItalic(r: PageRaster, it: TItem, lineSize: number): boolean {
  const x0 = Math.max(0, Math.floor(it.x * RS))
  const x1 = Math.min(r.width, Math.ceil((it.x + it.w) * RS))
  const y1 = Math.min(r.height, Math.floor(it.y * RS))
  const y0 = Math.max(0, Math.floor((it.y - lineSize * 0.75) * RS))
  if (x1 - x0 < 4 || y1 - y0 < 4) return false
  const pad = Math.ceil(0.25 * (y1 - y0)) + 1
  // Negative shear pulls the tops of glyphs left, which straightens italic strokes.
  const score = (shear: number) => {
    const hist = new Float64Array(x1 - x0 + 2 * pad)
    for (let y = y0; y < y1; y++) {
      const dx = Math.round(shear * (y1 - y))
      const base = y * r.width
      for (let x = x0; x < x1; x++) hist[x - x0 + dx + pad] += 255 - r.lum[base + x]
    }
    let s = 0
    for (const v of hist) s += v * v
    return s
  }
  return score(-0.21) > score(0) * 1.06
}

// ---------- per-question planning ----------

/**
 * Registers page jobs for a question and returns a finisher that assembles the
 * Question once every page it touches has been rendered.
 */
function planQuestion(s: QuestionSkeleton, work: Map<number, (r: PageRaster) => void>): () => Question {
  const on = (page: number, fn: (r: PageRaster) => void) => {
    const prev = work.get(page)
    work.set(page, prev ? (r) => (prev(r), fn(r)) : fn)
  }
  const ctx: Ctx = { qid: s.id, section: s.section, regularFont: s.regularFont, counter: { n: 0 } }
  const stemBlocks: Block[][] = s.stem.map(() => [])
  const choiceBlocks: Block[][][] = (s.choices ?? []).map((c) => c.segments.map(() => []))
  const rationale: Block[][] = s.rationale.map(() => [])
  let correctCrop: Crop | undefined

  s.stem.forEach((seg, i) => on(seg.page, (r) => (stemBlocks[i] = analyzeRegion(r, seg, seg.lines, ctx))))
  s.choices?.forEach((c, ci) => {
    c.segments.forEach((seg, si) => {
      on(seg.page, (r) => {
        const lines = si === 0 ? stripLabel(seg.lines) : seg.lines
        choiceBlocks[ci][si] = analyzeRegion(r, { ...seg, left: c.contentLeft }, lines, ctx)
      })
    })
  })
  s.rationale.forEach((seg, i) => on(seg.page, (r) => (rationale[i] = analyzeRegion(r, seg, seg.lines, ctx))))

  const cl = s.correctLine
  const spr = !s.choices
  if (cl && spr) {
    on(cl.page, (r) => {
      const rect: Segment = { page: cl.page, top: cl.top - 6, bottom: cl.bottom + 6, left: s.stem[0]?.left ?? 0, right: s.stem[0]?.right ?? 600, lines: [cl] }
      const { counts } = rowInk(r, rect)
      if (counts.some((c) => c >= INK_ROW_MIN) || !s.correctText) correctCrop = crop(r, rect, 'left') ?? undefined
    })
  }

  return () => {
    const blocks = mergeText(stemBlocks.flat())
    let stimulus: Block[] = []
    let prompt: Block[] = blocks
    if (s.section === 'rw') {
      const last = blocks[blocks.length - 1]
      if (last?.kind === 'text' && last.paragraphs.length > 0) {
        const q = last.paragraphs[last.paragraphs.length - 1]
        const restParas = last.paragraphs.slice(0, -1)
        stimulus = [...blocks.slice(0, -1), ...(restParas.length ? [{ kind: 'text' as const, paragraphs: restParas }] : [])]
        prompt = [{ kind: 'text', paragraphs: [q] }]
      }
    }
    const choices: Choice[] | null = s.choices
      ? s.choices.map((c, i) => ({ letter: c.letter, blocks: mergeText(choiceBlocks[i].flat()) }))
      : null

    let correct: string[] | null = null
    if (s.correctText !== null) {
      correct = spr
        ? s.correctText.split(/\s*(?:,|\bor\b)\s*/).map((v) => v.trim()).filter(Boolean)
        : (s.correctText.match(/[A-D]/g) ?? [])
      if (correct.length === 0 && !correctCrop) correct = null
    }

    return {
      id: s.id,
      section: s.section,
      ...s.meta,
      stimulus,
      prompt,
      choices,
      correct,
      correctCrop,
      rationale: mergeText(rationale.flat()),
    }
  }
}

function mergeText(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    const last = out[out.length - 1]
    if (b.kind === 'text' && last?.kind === 'text') last.paragraphs.push(...b.paragraphs)
    else out.push(b.kind === 'text' ? { kind: 'text', paragraphs: [...b.paragraphs] } : b)
  }
  return out.filter((b) => b.kind !== 'text' || b.paragraphs.length > 0)
}
