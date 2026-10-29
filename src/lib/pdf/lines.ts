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
  /** Raised/lowered smaller text attached to a line (⁸⁷Sr, CO₂). */
  script?: 'sup' | 'sub'
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

export interface RawItem {
  str: string
  transform: number[]
  width: number
  height: number
  fontName: string
}

/**
 * Some College Board exports (Type 3 glyph fonts) emit one item per word with real
 * spaces as separate " " items, and pdf.js adds bogus spaces *inside* items at
 * kerning gaps ("repor ted", "Mar ta"). In that word-per-item mode, inner spaces in
 * fonts that emit space items are noise. Other exports embed real fonts and give
 * whole phrases per item, whose inner spaces are genuine and must be kept.
 */
/** Decided once per document: a short page (say, the tail of a rationale) is too little evidence. */
export function isWordPerItem(raw: RawItem[]): boolean {
  const words = raw.filter((r) => r.str.trim() !== '')
  const phrases = words.filter((r) => (r.str.trim().match(/ /g) ?? []).length >= 2).length
  return words.length > 0 && phrases / words.length < 0.02
}

export function toItems(raw: RawItem[], pageTop: number, pageLeft: number, wordPerItem: boolean): TItem[] {
  const nonEmpty = raw.filter((r) => r.str.length > 0)
  const spaceFonts = wordPerItem ? new Set(nonEmpty.filter((r) => r.str.trim() === '').map((r) => r.fontName)) : new Set<string>()

  return nonEmpty.map((r) => {
    r = { ...r, str: unligature(r.str) }
    const isSpace = r.str.trim() === ''
    const size = Math.hypot(r.transform[2], r.transform[3]) || r.height || 10
    return {
      str: isSpace ? ' ' : spaceFonts.has(r.fontName) ? r.str.replace(/([a-z]) (?=[a-z])/g, '$1') : r.str,
      x: r.transform[4] - pageLeft,
      y: pageTop - r.transform[5],
      w: r.width,
      size,
      font: r.fontName,
      isSpace,
    }
  })
}

const LIGATURES: Record<string, string> = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' }

/** Real-font exports keep typographic ligatures ("Diﬃculty"); expand them so text matches and reads normally. */
function unligature(s: string): string {
  return s.replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
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
    if (out && !out.endsWith(' ') && !it.script && it.x - prevEnd > it.size * 0.2) out += ' '
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
  return attachScripts(lines.filter((l) => l.text.length > 0).sort((a, b) => a.baseline - b.baseline))
}

/**
 * Superscripts and subscripts land on their own baseline. Fold a line of small text into
 * the neighbouring normal-size line it overlaps, so "⁸⁷Sr/⁸⁶Sr" stays one line of text.
 */
function attachScripts(lines: Line[]): Line[] {
  const out = [...lines]
  for (const small of lines) {
    const glyphs = small.items.filter((i) => !i.isSpace)
    const host = out.find(
      (h) =>
        h !== small &&
        h.page === small.page &&
        glyphs.length > 0 &&
        glyphs.every((g) => g.size < h.size * 0.9) &&
        small.baseline > h.top &&
        small.baseline < h.bottom + h.size * 0.2 &&
        small.x0 < h.x1 + h.size &&
        small.x1 > h.x0 - h.size,
    )
    if (!host) continue
    // The script line's own space items span the host's glyphs between them ("⁸⁷Sr/⁸⁶"); drop them.
    for (const it of glyphs) {
      const script = it.y < host.baseline - host.size * 0.15 ? 'sup' : it.y > host.baseline + host.size * 0.1 ? 'sub' : undefined
      host.items.push({ ...it, script })
    }
    host.items.sort((a, b) => a.x - b.x)
    host.text = joinItems(host.items)
    out.splice(out.indexOf(small), 1)
  }
  return out
}
