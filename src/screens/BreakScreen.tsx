import { useEffect } from 'react'
import { formatClock } from '@/components/bluebook/Header'
import { useApp } from '@/lib/store'

export function BreakScreen() {
  const remaining = useApp((s) => s.breakRemaining)
  const endBreak = useApp((s) => s.endBreak)

  useEffect(() => {
    const t = setInterval(() => useApp.getState().tickBreak(), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="grid min-h-dvh place-items-center bg-bb-ink px-6 text-white">
      <div className="grid w-full max-w-4xl gap-10 md:grid-cols-2 md:items-center">
        <div className="text-center">
          <div className="inline-block rounded-2xl border border-white/30 px-10 py-6">
            <div className="text-sm font-semibold tracking-wide text-white/70">Remaining Break Time:</div>
            <div className="mt-1 text-6xl font-bold tabular-nums">{formatClock(remaining)}</div>
          </div>
          <div className="mt-8">
            <button className="rounded-full bg-[#fedb00] px-8 py-2.5 font-semibold text-bb-ink hover:bg-[#f5d000]" onClick={endBreak}>
              Resume Testing
            </button>
          </div>
        </div>
        <div className="space-y-4 text-[15px] leading-relaxed">
          <h1 className="text-2xl font-bold">Practice Test Break</h1>
          <p>You can resume this practice test as soon as you're ready to move on. On test day, you'll wait until the clock counts down.</p>
          <h2 className="pt-2 font-semibold">Take a Break: Do Not Close Your Device</h2>
          <p>After the break, the Math section begins. Stretch, grab some water, and come back ready.</p>
        </div>
      </div>
    </div>
  )
}
