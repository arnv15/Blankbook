// Turns pdf.js text items into reading-order lines, in top-down page coordinates (points).

export interface TItem {
  str: string
  x: number
  /** Baseline, measured from the top of the page. */
  y: number
  w: number
  size: number
  font: string
  isSpace: boolean
}

export interface Line {
  page: number
  baseline: number
  top: number
  bottom: number
  x0: number
  x1: number
  size: number
  items: TItem[]
  text: string
}

interface RawItem {
  str: string
  transform: number[]
  width: number
  height: number
  fontName: string
}

/**
 * College Board exports emit real word spaces as separate " " items, and pdf.js
 * adds bogus spaces *inside* items at kerning gaps ("repor ted", "Mar ta").
 * For fonts that emit separate space items, inner spaces are noise and get stripped.
 * Figure labels (charts, tables) use other fonts whose inner spaces are real.
 */
export function toItems(raw: RawItem[], pageTop: number, pageLeft: number): TItem[] {
  const nonEmpty = raw.filter((r) => r.str.length > 0)
  const spaceFonts = new Set(nonEmpty.filter((r) => r.str.trim() === '').map((r) => r.fontName))

  return nonEmpty.map((r) => {
    const isSpace = r.str.trim() === ''
    const size = Math.hypot(r.transform[2], r.transform[3]) || r.height || 10
    return {
      str: isSpace ? ' ' : spaceFonts.has(r.fontName) ? r.str.replace(/(\S) (?=\S)/g, '$1') : r.str,
      x: r.transform[4] - pageLeft,
      y: pageTop - r.transform[5],
      w: r.width,
      size,
      font: r.fontName,
      isSpace,
    }
  })
}

/** Joins items left-to-right, inserting a space when glyphs are visibly apart. */
export function joinItems(items: TItem[]): string {
  let out = ''
  let prevEnd = -Infinity
  for (const it of items) {
    if (it.isSpace) {
      if (out && !out.endsWith(' ')) out += ' '
      prevEnd = it.x + it.w
      continue
    }
    if (out && !out.endsWith(' ') && it.x - prevEnd > it.size * 0.2) out += ' '
    out += it.str
    prevEnd = it.x + it.w
  }
  return out.trim()
}

export function groupLines(items: TItem[], page: number): Line[] {
  const glyphs = items.filter((i) => !i.isSpace || i.w > 0)
  const sorted = [...glyphs].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: Line[] = []
  for (const it of sorted) {
    const tol = it.size * 0.35
    // Search backwards: superscript-ish items (raised apostrophes) can land slightly off-baseline.
    const line = lines.findLast((l) => Math.abs(l.baseline - it.y) <= tol)
    if (line) line.items.push(it)
    else
      lines.push({ page, baseline: it.y, top: 0, bottom: 0, x0: 0, x1: 0, size: it.size, items: [it], text: '' })
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x)
    const glyphItems = l.items.filter((i) => !i.isSpace)
    l.size = Math.max(...glyphItems.map((i) => i.size), l.size)
    l.top = l.baseline - l.size * 0.95
    l.bottom = l.baseline + l.size * 0.3
    l.x0 = Math.min(...glyphItems.map((i) => i.x))
    l.x1 = Math.max(...glyphItems.map((i) => i.x + i.w))
    l.text = joinItems(l.items)
  }
  return lines.filter((l) => l.text.length > 0).sort((a, b) => a.baseline - b.baseline)
}
