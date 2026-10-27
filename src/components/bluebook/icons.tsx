import { cn } from '@/lib/utils'

export function BookmarkIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 20" className={cn('h-5 w-4', className)} aria-hidden>
      <path
        d="M2 1.5h12v17l-6-4.2-6 4.2z"
        fill={filled ? 'var(--bb-red)' : 'none'}
        stroke={filled ? 'var(--bb-red)' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 20" className={cn('h-5 w-4', className)} aria-hidden>
      <path d="M8 19s6-6.4 6-11A6 6 0 0 0 2 8c0 4.6 6 11 6 11z" fill="#1e1e1e" />
      <circle cx="8" cy="8" r="2.3" fill="#fff" />
    </svg>
  )
}

/** The "ABC" option-eliminator toggle with a strike through it. */
export function EliminatorIcon({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-block px-0.5 text-[13px] leading-none font-bold tracking-tight', className)}>
      ABC
      <span className="absolute top-1/2 left-[-3px] right-[-3px] h-[1.5px] -rotate-[18deg] bg-current" />
    </span>
  )
}

export function CalculatorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6', className)} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
      <rect x="7.5" y="5.5" width="9" height="4" rx="0.5" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01M16 16.5h.01" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function ReferenceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6', className)} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M5 3.5h10l4 4v13H5z" strokeLinejoin="round" />
      <path d="M15 3.5v4h4" strokeLinejoin="round" />
      <text x="7.2" y="17.5" fontSize="8" fontFamily="serif" fontStyle="italic" fill="currentColor" stroke="none">
        x²
      </text>
    </svg>
  )
}

export function HighlightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6', className)} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M14.5 4.5l5 5L10 19H5v-5z" strokeLinejoin="round" />
      <path d="M12.5 6.5l5 5" />
      <path d="M3 21.5h18" strokeWidth="2.2" stroke="#f2b434" />
    </svg>
  )
}
