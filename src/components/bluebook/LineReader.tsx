import { GripHorizontal, Minus, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const LINE = 27

/** Masks the screen except for a draggable reading window a few lines tall. */
export function LineReader({ onClose }: { onClose(): void }) {
  const [top, setTop] = useState(() => Math.round(window.innerHeight * 0.35))
  const [lines, setLines] = useState(2)
  const drag = useRef<number | null>(null)
  const height = lines * LINE + 12

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowDown') setTop((t) => Math.min(window.innerHeight - height, t + LINE))
      if (e.altKey && e.key === 'ArrowUp') setTop((t) => Math.max(0, t - LINE))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [height])

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      drag.current = e.clientY - top
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (drag.current === null) return
      setTop(Math.min(window.innerHeight - height, Math.max(0, e.clientY - drag.current)))
    },
    onPointerUp: () => (drag.current = null),
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <div className="absolute inset-x-0 top-0 bg-black/70" style={{ height: top }} />
      <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ top: top + height }} />
      <div className="absolute inset-x-0 border-y-2 border-bb-ink" style={{ top, height }} />
      <div
        className="pointer-events-auto absolute left-1/2 flex h-8 -translate-x-1/2 cursor-grab touch-none items-center gap-1 rounded-t-lg bg-bb-ink px-2 text-white select-none active:cursor-grabbing"
        style={{ top: top - 32 }}
        {...handlers}
      >
        <button aria-label="Fewer lines" className="rounded p-1 hover:bg-white/15" onClick={() => setLines((l) => Math.max(1, l - 1))}>
          <Minus className="size-4" />
        </button>
        <GripHorizontal className="size-5 opacity-80" />
        <button aria-label="More lines" className="rounded p-1 hover:bg-white/15" onClick={() => setLines((l) => Math.min(6, l + 1))}>
          <Plus className="size-4" />
        </button>
        <button aria-label="Close line reader" className="ml-1 rounded p-1 hover:bg-white/15" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
