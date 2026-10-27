import { Trash2, Underline, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/lib/store'
import type { Block, Highlight, HighlightColor } from '@/lib/types'
import { cn } from '@/lib/utils'
import { BlockView, selectionRanges } from './BlockView'

/** Stable fallback: a fresh `[]` in a selector would re-render forever. */
const NONE: Highlight[] = []

const COLORS: { color: HighlightColor; bg: string; label: string }[] = [
  { color: 'yellow', bg: 'bg-[#fde68a]', label: 'Yellow' },
  { color: 'blue', bg: 'bg-[#bfdbfe]', label: 'Blue' },
  { color: 'pink', bg: 'bg-[#fbcfe8]', label: 'Pink' },
]

interface Toolbar {
  x: number
  y: number
  ids: string[]
}

/** Blocks with Bluebook's Highlights & Notes: select text to highlight, click a highlight to edit it. */
export function Annotatable({ questionId, blocks, className }: { questionId: string; blocks: Block[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const highlights = useApp((s) => s.highlights[questionId] ?? NONE)
  const setHighlights = useApp((s) => s.setHighlights)
  const [toolbar, setToolbar] = useState<Toolbar | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)

  const active = toolbar ? highlights.filter((h) => toolbar.ids.includes(h.id)) : []
  const save = (hs: Highlight[]) => setHighlights(questionId, hs)

  const placeAt = (rect: DOMRect, ids: string[]) => {
    const host = rootRef.current!.getBoundingClientRect()
    setToolbar({ x: rect.left + rect.width / 2 - host.left, y: rect.bottom - host.top + 8, ids })
  }

  const createFromSelection = (color: HighlightColor = 'yellow') => {
    const root = rootRef.current
    if (!root) return false
    const ranges = selectionRanges(root)
    if (ranges.length === 0) return false
    const sel = window.getSelection()!
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    const created: Highlight[] = ranges.map((r) => ({
      id: crypto.randomUUID(),
      ...r,
      color,
      underline: false,
      note: '',
    }))
    save([...highlights, ...created])
    sel.removeAllRanges()
    placeAt(rect, created.map((h) => h.id))
    setNoteOpen(false)
    return true
  }

  // The header's "Highlights & Notes" button highlights the current selection.
  useEffect(() => {
    const onTool = (e: Event) => {
      if (createFromSelection()) e.preventDefault()
    }
    window.addEventListener('bb:highlight', onTool)
    return () => window.removeEventListener('bb:highlight', onTool)
  })

  useEffect(() => {
    if (!toolbar) return
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setToolbar(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [toolbar])

  const onMouseUp = () => {
    // Defer so the selection has settled.
    setTimeout(() => {
      if (rootRef.current && selectionRanges(rootRef.current).length > 0) createFromSelection()
    }, 0)
  }

  const update = (patch: Partial<Highlight>) => save(highlights.map((h) => (toolbar?.ids.includes(h.id) ? { ...h, ...patch } : h)))

  return (
    <div ref={rootRef} className={cn('relative', className)} onMouseUp={onMouseUp}>
      <BlockView
        blocks={blocks}
        highlights={highlights}
        activeHighlight={toolbar?.ids[0] ?? null}
        onHighlightClick={(h, el) => {
          if (window.getSelection()?.isCollapsed === false) return
          placeAt(el.getBoundingClientRect(), [h.id])
          setNoteOpen(!!h.note)
        }}
      />
      {toolbar && active.length > 0 && (
        <div
          className="absolute z-30 w-80 -translate-x-1/2 rounded-lg border border-neutral-300 bg-white p-2 font-sans text-sm shadow-xl"
          style={{ left: Math.max(150, toolbar.x), top: toolbar.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.color}
                aria-label={`${c.label} highlight`}
                className={cn(
                  'size-7 rounded-full border-2',
                  c.bg,
                  active[0].color === c.color ? 'border-bb-blue' : 'border-transparent',
                )}
                onClick={() => update({ color: c.color })}
              />
            ))}
            <button
              aria-label="Underline"
              className={cn(
                'ml-1 grid size-7 place-items-center rounded-md border',
                active[0].underline ? 'border-bb-blue bg-blue-50 text-bb-blue' : 'border-neutral-300',
              )}
              onClick={() => update({ underline: !active[0].underline })}
            >
              <Underline className="size-4" />
            </button>
            <button
              className="ml-auto rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-bb-blue hover:bg-blue-50"
              onClick={() => setNoteOpen((v) => !v)}
            >
              {noteOpen ? 'Hide note' : active[0].note ? 'Edit note' : 'Add note'}
            </button>
            <button
              aria-label="Delete highlight"
              className="grid size-7 place-items-center rounded-md text-neutral-600 hover:bg-red-50 hover:text-bb-red"
              onClick={() => {
                save(highlights.filter((h) => !toolbar.ids.includes(h.id)))
                setToolbar(null)
              }}
            >
              <Trash2 className="size-4" />
            </button>
            <button aria-label="Close" className="grid size-7 place-items-center rounded-md hover:bg-neutral-100" onClick={() => setToolbar(null)}>
              <X className="size-4" />
            </button>
          </div>
          {noteOpen && (
            <textarea
              autoFocus
              value={active[0].note}
              onChange={(e) => update({ note: e.target.value })}
              placeholder="Type a note…"
              className="mt-2 h-20 w-full resize-none rounded-md border border-neutral-300 p-2 text-sm outline-none focus:border-bb-blue"
            />
          )}
        </div>
      )}
    </div>
  )
}
