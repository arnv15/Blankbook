import type { Block, Crop, Highlight, Paragraph } from '@/lib/types'
import { cn } from '@/lib/utils'

/** CSS px per PDF point: makes 8.8pt PDF body text land near Bluebook's ~16px. */
export const CROP_SCALE = 1.85

export function CropImage({ crop, className }: { crop: Crop; className?: string }) {
  return (
    <img
      src={crop.src}
      alt=""
      draggable={false}
      className={cn('bb-crop block select-none', crop.align === 'center' && 'mx-auto', className)}
      // Figures read fine a little smaller than body text scale.
      style={{ width: crop.w * (crop.align === 'center' ? 1.55 : CROP_SCALE) }}
    />
  )
}

interface Props {
  blocks: Block[]
  highlights?: Highlight[]
  activeHighlight?: string | null
  onHighlightClick?: (h: Highlight, el: HTMLElement) => void
  className?: string
}

export function BlockView({ blocks, highlights = [], activeHighlight, onHighlightClick, className }: Props) {
  return (
    <div className={cn('bb-content space-y-4', className)}>
      {blocks.map((b, i) =>
        b.kind === 'image' ? (
          <CropImage key={i} crop={b.crop} />
        ) : (
          <div key={i} className="space-y-4">
            {b.paragraphs.map((p) => (
              <ParagraphView
                key={p.id}
                p={p}
                highlights={highlights.filter((h) => h.paragraphId === p.id)}
                activeHighlight={activeHighlight}
                onHighlightClick={onHighlightClick}
              />
            ))}
          </div>
        ),
      )}
    </div>
  )
}

/** Plain text of blocks, with inline math shown as "…" (for previews). */
export function blocksText(blocks: Block[]) {
  return blocks
    .flatMap((b) => (b.kind === 'text' ? b.paragraphs.map((p) => p.runs.map((r) => (r.img ? '…' : r.text)).join('')) : []))
    .join(' ')
}

/**
 * Splits the paragraph at every run and highlight boundary. Each piece carries its
 * character offset (`data-off`) so a DOM selection can be mapped back to offsets.
 */
function ParagraphView({
  p,
  highlights,
  activeHighlight,
  onHighlightClick,
}: {
  p: Paragraph
  highlights: Highlight[]
  activeHighlight?: string | null
  onHighlightClick?: (h: Highlight, el: HTMLElement) => void
}) {
  const cuts = new Set<number>([0])
  let off = 0
  for (const r of p.runs) {
    off += r.text.length
    cuts.add(off)
  }
  for (const h of highlights) {
    cuts.add(h.start)
    cuts.add(h.end)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const runAt = (pos: number) => {
    let o = 0
    for (const r of p.runs) {
      if (pos < o + r.text.length) return { run: r, start: o }
      o += r.text.length
    }
    return null
  }
  const pieces = points.slice(0, -1).map((start, i) => {
    const end = points[i + 1]
    const found = runAt(start)
    if (!found) return null
    const text = found.run.text.slice(start - found.start, end - found.start)
    // Last-created highlight wins where they overlap.
    const h = highlights.findLast((x) => x.start <= start && x.end >= end)
    const style = cn(found.run.italic && 'italic', found.run.bold && 'font-bold')
    const img = found.run.img
    const span = img ? (
      <span key={start} data-off={start}>
        <img
          src={img.src}
          alt=""
          draggable={false}
          className="inline max-w-none select-none"
          style={{ width: img.w * CROP_SCALE, height: img.h * CROP_SCALE, verticalAlign: -img.drop * CROP_SCALE }}
        />
      </span>
    ) : (
      <span key={start} data-off={start} className={style || undefined}>
        {text}
      </span>
    )
    if (!h) return span
    return (
      <mark
        key={start}
        className="bb-hl"
        data-hid={h.id}
        data-color={h.color}
        data-underline={h.underline}
        data-active={activeHighlight === h.id}
        title={h.note || undefined}
        onClick={(e) => onHighlightClick?.(h, e.currentTarget)}
      >
        {span}
      </mark>
    )
  })
  return <p data-pid={p.id}>{pieces}</p>
}

/** Maps the current DOM selection inside `root` to per-paragraph character ranges. */
export function selectionRanges(root: HTMLElement): { paragraphId: string; start: number; end: number }[] {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return []
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return []

  const pos = (node: Node, offset: number): number | null => {
    const el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element))?.closest<HTMLElement>('[data-off]')
    if (!el) return null
    return Number(el.dataset.off) + (node.nodeType === Node.TEXT_NODE ? offset : 0)
  }
  const out: { paragraphId: string; start: number; end: number }[] = []
  for (const p of root.querySelectorAll<HTMLElement>('[data-pid]')) {
    if (!range.intersectsNode(p)) continue
    const len = p.textContent?.length ?? 0
    const start = p.contains(range.startContainer) ? (pos(range.startContainer, range.startOffset) ?? 0) : 0
    const end = p.contains(range.endContainer) ? (pos(range.endContainer, range.endOffset) ?? len) : len
    if (end > start) out.push({ paragraphId: p.dataset.pid!, start, end })
  }
  return out
}
