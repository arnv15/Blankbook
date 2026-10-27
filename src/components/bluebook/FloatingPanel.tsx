import { GripHorizontal, Maximize2, Minimize2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  initial: { x: number; y: number; w: number; h: number }
  onClose(): void
  toolbar?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** A draggable, resizable window, like Bluebook's calculator and reference sheet. */
export function FloatingPanel({ title, initial, onClose, toolbar, children, className }: Props) {
  const [pos, setPos] = useState({ x: initial.x, y: initial.y })
  const [expanded, setExpanded] = useState(false)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPos({
      x: Math.min(window.innerWidth - 80, Math.max(-200, e.clientX - drag.current.dx)),
      y: Math.min(window.innerHeight - 40, Math.max(0, e.clientY - drag.current.dy)),
    })
  }
  const end = () => {
    drag.current = null
    setDragging(false)
  }

  return (
    <div
      role="dialog"
      aria-label={title}
      className={cn('fixed z-40 flex flex-col overflow-hidden rounded-lg bg-white shadow-[0_8px_40px_rgba(0,0,0,0.3)]', !expanded && 'resize', className)}
      style={
        expanded
          ? { left: 8, top: 80, width: 'min(960px, calc(100vw - 16px))', height: 'calc(100vh - 160px)' }
          : { left: pos.x, top: pos.y, width: initial.w, height: initial.h, minWidth: 280, minHeight: 240 }
      }
    >
      <div
        className="flex h-11 shrink-0 cursor-grab touch-none items-center gap-2 bg-bb-ink px-3 text-white select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className="text-sm font-semibold">{title}</span>
        <GripHorizontal className="mx-auto size-5 opacity-70" />
        {toolbar}
        <button aria-label={expanded ? 'Collapse' : 'Expand'} className="rounded p-1 hover:bg-white/15" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button aria-label="Close" className="rounded p-1 hover:bg-white/15" onClick={onClose}>
          <X className="size-5" />
        </button>
      </div>
      {/* While dragging, block iframes from swallowing pointer events. */}
      <div className={cn('relative min-h-0 flex-1', dragging && 'pointer-events-none')}>{children}</div>
    </div>
  )
}
