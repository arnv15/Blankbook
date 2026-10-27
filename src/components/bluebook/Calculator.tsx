import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { FloatingPanel } from './FloatingPanel'

// Desmos hosts the exact builds Bluebook embeds for the digital SAT.
const URLS = {
  graphing: 'https://www.desmos.com/testing/collegeboard/graphing',
  scientific: 'https://www.desmos.com/testing/collegeboard/scientific',
}

export function Calculator({ onClose }: { onClose(): void }) {
  const [mode, setMode] = useState<keyof typeof URLS>('graphing')
  // Keep both iframes mounted so switching modes doesn't wipe your work.
  const [loaded, setLoaded] = useState<Set<string>>(new Set(['graphing']))

  return (
    <FloatingPanel
      title="Calculator"
      initial={{ x: 16, y: 88, w: 440, h: 580 }}
      onClose={onClose}
      toolbar={
        <div className="flex rounded-full bg-white/15 p-0.5 text-xs font-semibold">
          {(['graphing', 'scientific'] as const).map((m) => (
            <button
              key={m}
              className={cn('rounded-full px-2.5 py-1 capitalize', mode === m ? 'bg-white text-bb-ink' : 'text-white')}
              onClick={() => {
                setMode(m)
                setLoaded((s) => new Set(s).add(m))
              }}
            >
              {m}
            </button>
          ))}
          <a
            href={URLS[mode]}
            target="_blank"
            rel="noreferrer"
            aria-label="Open calculator in a new tab"
            title="Open in a new tab"
            className="ml-1 grid place-items-center rounded-full px-1.5 text-white hover:bg-white/15"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      }
    >
      {[...loaded].map((m) => (
        <iframe
          key={m}
          title={`Desmos ${m} calculator`}
          src={URLS[m as keyof typeof URLS]}
          className={cn('absolute inset-0 size-full border-0', m !== mode && 'invisible')}
        />
      ))}
    </FloatingPanel>
  )
}
