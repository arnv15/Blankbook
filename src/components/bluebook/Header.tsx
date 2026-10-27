import { AlarmClock, ChevronDown, EllipsisVertical, HelpCircle, LogOut, Rows3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { sectionLabel, useApp } from '@/lib/store'
import type { Module } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Directions } from './Directions'
import { CalculatorIcon, HighlightIcon, ReferenceIcon } from './icons'

export function formatClock(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  module: Module
  calculatorOpen: boolean
  referenceOpen: boolean
  lineReaderOpen: boolean
  onCalculator(): void
  onReference(): void
  onLineReader(): void
  questionSeconds: number | null
}

export function Header({ module, calculatorOpen, referenceOpen, lineReaderOpen, onCalculator, onReference, onLineReader, questionSeconds }: Props) {
  const remaining = useApp((s) => s.remaining)
  const elapsed = useApp((s) => s.elapsed)
  const warned = useApp((s) => s.fiveMinuteWarned)
  const exit = useApp((s) => s.exit)
  const [hidden, setHidden] = useState(false)
  const [directionsOpen, setDirectionsOpen] = useState(module.moduleNumber === 1 && module.sectionNumber === 1)
  const [helpOpen, setHelpOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)

  const lastFive = remaining !== null && remaining <= 300
  // Like Bluebook: the timer can be hidden until 5 minutes remain, then it reappears with an alert.
  useEffect(() => {
    if (lastFive && !warned && remaining! > 0) {
      useApp.setState({ fiveMinuteWarned: true })
      setHidden(false)
      toast('5 minutes remaining in this module.', { icon: <AlarmClock className="size-4" /> })
    }
  }, [lastFive, warned, remaining])

  const title = `Section ${module.sectionNumber}, Module ${module.moduleNumber}: ${sectionLabel(module.section)}`
  const clock = remaining !== null ? remaining : elapsed

  return (
    <header className="relative z-20 shrink-0 bg-bb-chrome">
      <div className="grid h-[4.5rem] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-7">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold text-bb-ink sm:text-lg">{title}</h1>
          <button className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-bb-ink hover:underline" onClick={() => setDirectionsOpen((v) => !v)}>
            Directions <ChevronDown className={cn('size-4 transition-transform', directionsOpen && 'rotate-180')} />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {hidden && !lastFive ? (
            <AlarmClock className="size-6 text-bb-ink" aria-label="Timer hidden" />
          ) : (
            <div
              className={cn('text-xl font-bold tabular-nums text-bb-ink', lastFive && 'text-bb-red', remaining === null && 'text-neutral-600')}
              aria-live={lastFive ? 'polite' : 'off'}
              title={remaining === null ? 'Untimed: time elapsed' : 'Time remaining'}
            >
              {formatClock(clock)}
            </div>
          )}
          {!lastFive && (
            <button
              className="mt-0.5 rounded-full border border-bb-ink px-2.5 text-xs leading-5 font-semibold text-bb-ink hover:bg-white"
              onClick={() => setHidden((v) => !v)}
            >
              {hidden ? 'Show' : 'Hide'}
            </button>
          )}
          {questionSeconds !== null && (
            <div className={cn('mt-0.5 text-[11px] font-medium tabular-nums', questionSeconds <= 10 ? 'text-bb-red' : 'text-neutral-600')}>
              This question: {formatClock(Math.max(0, questionSeconds))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-3">
          {module.section === 'rw' ? (
            <ToolButton
              label="Highlights & Notes"
              // Listeners cancel the event when they turned a selection into a highlight.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (window.dispatchEvent(new Event('bb:highlight', { cancelable: true }))) toast('Select text in the passage or question to highlight it.')
              }}
            >
              <HighlightIcon />
            </ToolButton>
          ) : (
            <>
              <ToolButton label="Calculator" active={calculatorOpen} onClick={onCalculator}>
                <CalculatorIcon />
              </ToolButton>
              <ToolButton label="Reference" active={referenceOpen} onClick={onReference}>
                <ReferenceIcon />
              </ToolButton>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolButton label="More">
                <EllipsisVertical className="size-6" />
              </ToolButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setHelpOpen(true)}>
                <HelpCircle /> Help
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onLineReader}>
                <Rows3 /> {lineReaderOpen ? 'Hide Line Reader' : 'Line Reader'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setExitOpen(true)}>
                <LogOut /> Exit Practice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="bb-rule" />

      {directionsOpen && <Directions section={module.section} onClose={() => setDirectionsOpen(false)} />}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Testing tools</DialogTitle>
            <DialogDescription>Everything works like the Bluebook app.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li><strong>Timer</strong>: hide it until the last 5 minutes, when it comes back with an alert.</li>
            <li><strong>Highlights & Notes</strong> (Reading and Writing): select passage or question text to highlight it, then click a highlight to change its color, underline it, add a note, or delete it.</li>
            <li><strong>Mark for Review</strong>: bookmark a question so it stands out in the question menu.</li>
            <li><strong>Option eliminator</strong>: click the ABC button, then cross out choices. Click Undo to restore.</li>
            <li><strong>Calculator & Reference</strong> (Math): Desmos graphing/scientific calculator and the formula sheet. Drag them anywhere.</li>
            <li><strong>Line Reader</strong> (More menu): drag the window to focus on a few lines at a time.</li>
            <li><strong>Question menu</strong>: click "Question X of Y" at the bottom to jump anywhere in the module.</li>
          </ul>
          <p className="text-xs text-neutral-500">Shortcuts: ← / → for Back / Next when you're not typing, and Esc closes menus.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exit this practice?</DialogTitle>
            <DialogDescription>Your answers for this attempt will be discarded. The question set stays saved on this device.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitOpen(false)}>
              Keep Testing
            </Button>
            <Button variant="destructive" onClick={exit}>
              Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}

function ToolButton({
  label,
  active,
  children,
  ...rest
}: { label: string; active?: boolean; children: React.ReactNode } & React.ComponentProps<'button'>) {
  return (
    <button
      {...rest}
      className={cn(
        'flex min-w-14 flex-col items-center gap-0.5 rounded-md px-1.5 py-1 text-bb-ink hover:bg-white/70',
        active && 'bg-white text-bb-blue shadow-[inset_0_-2px_0_var(--bb-blue)]',
      )}
    >
      {children}
      <span className="hidden text-xs font-medium whitespace-nowrap md:block">{label}</span>
    </button>
  )
}
