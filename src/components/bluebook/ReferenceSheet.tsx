import { FloatingPanel } from './FloatingPanel'

const S = { fill: 'none', stroke: '#1e1e1e', strokeWidth: 1.5 } as const
const T = { fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: 13, fill: '#1e1e1e' } as const

function Fig({ children, formula, view = '0 0 120 90' }: { children: React.ReactNode; formula: React.ReactNode; view?: string }) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox={view} className="h-24 w-32">
        {children}
      </svg>
      <figcaption className="mt-1 text-center font-serif text-[15px]">{formula}</figcaption>
    </figure>
  )
}

const i = (s: string) => <em>{s}</em>

export function ReferenceSheet({ onClose }: { onClose(): void }) {
  return (
    <FloatingPanel title="Reference" initial={{ x: Math.max(16, window.innerWidth - 720), y: 88, w: 680, h: 560 }} onClose={onClose}>
      <div className="absolute inset-0 overflow-y-auto p-5 text-bb-ink">
        <div className="grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-3">
          <Fig formula={<>{i('A')} = π{i('r')}² <br /> {i('C')} = 2π{i('r')}</>}>
            <circle cx="60" cy="45" r="36" {...S} />
            <line x1="60" y1="45" x2="96" y2="45" {...S} />
            <circle cx="60" cy="45" r="2" fill="#1e1e1e" />
            <text x="74" y="40" {...T}>r</text>
          </Fig>
          <Fig formula={<>{i('A')} = {i('ℓw')}</>}>
            <rect x="12" y="20" width="96" height="52" {...S} />
            <text x="56" y="86" {...T}>ℓ</text>
            <text x="112" y="50" {...T}>w</text>
          </Fig>
          <Fig formula={<>{i('A')} = ½{i('bh')}</>}>
            <path d="M10 76 L110 76 L78 14 Z" {...S} />
            <line x1="78" y1="14" x2="78" y2="76" {...S} strokeDasharray="4 3" />
            <path d="M78 68 h8 v8" {...S} strokeWidth={1} />
            <text x="56" y="89" {...T}>b</text>
            <text x="82" y="48" {...T}>h</text>
          </Fig>
          <Fig formula={<>{i('c')}² = {i('a')}² + {i('b')}²</>}>
            <path d="M14 76 L106 76 L106 14 Z" {...S} />
            <path d="M98 76 v-8 h8" {...S} strokeWidth={1} />
            <text x="52" y="40" {...T}>c</text>
            <text x="110" y="50" {...T}>a</text>
            <text x="58" y="89" {...T}>b</text>
          </Fig>
          <Fig formula={<>Special Right Triangles</>} view="0 0 120 92">
            <path d="M14 76 L80 76 L80 16 Z" {...S} />
            <path d="M72 76 v-8 h8" {...S} strokeWidth={1} />
            <text x="34" y="40" {...T}>2x</text>
            <text x="84" y="50" {...T}>x√3</text>
            <text x="44" y="89" {...T}>x</text>
            <text x="22" y="72" fontSize="10" fill="#1e1e1e">60°</text>
            <text x="66" y="30" fontSize="10" fill="#1e1e1e">30°</text>
          </Fig>
          <Fig formula={<>&nbsp;</>} view="0 0 120 92">
            <path d="M20 76 L84 76 L84 12 Z" {...S} />
            <path d="M76 76 v-8 h8" {...S} strokeWidth={1} />
            <text x="34" y="40" {...T}>s√2</text>
            <text x="88" y="48" {...T}>s</text>
            <text x="48" y="89" {...T}>s</text>
            <text x="30" y="72" fontSize="10" fill="#1e1e1e">45°</text>
            <text x="70" y="26" fontSize="10" fill="#1e1e1e">45°</text>
          </Fig>
          <Fig formula={<>{i('V')} = {i('ℓwh')}</>}>
            <path d="M14 34 L74 34 L74 78 L14 78 Z M14 34 L40 14 L100 14 L74 34 M100 14 L100 58 L74 78" {...S} />
            <path d="M14 78 L40 58 L100 58 M40 58 L40 14" {...S} strokeDasharray="4 3" strokeWidth={1} />
            <text x="40" y="89" {...T}>ℓ</text>
            <text x="88" y="78" {...T}>w</text>
            <text x="2" y="58" {...T}>h</text>
          </Fig>
          <Fig formula={<>{i('V')} = π{i('r')}²{i('h')}</>}>
            <ellipse cx="60" cy="18" rx="30" ry="9" {...S} />
            <path d="M30 18 V72 M90 18 V72" {...S} />
            <path d="M30 72 A30 9 0 0 0 90 72" {...S} />
            <path d="M30 72 A30 9 0 0 1 90 72" {...S} strokeDasharray="4 3" strokeWidth={1} />
            <line x1="60" y1="18" x2="90" y2="18" {...S} strokeWidth={1} />
            <text x="70" y="14" {...T}>r</text>
            <text x="94" y="50" {...T}>h</text>
          </Fig>
          <Fig formula={<>{i('V')} = <sup>4</sup>⁄<sub>3</sub>π{i('r')}³</>}>
            <circle cx="60" cy="45" r="36" {...S} />
            <path d="M24 45 A36 10 0 0 0 96 45" {...S} strokeWidth={1} />
            <path d="M24 45 A36 10 0 0 1 96 45" {...S} strokeDasharray="4 3" strokeWidth={1} />
            <line x1="60" y1="45" x2="96" y2="45" {...S} strokeWidth={1} />
            <text x="74" y="40" {...T}>r</text>
          </Fig>
          <Fig formula={<>{i('V')} = <sup>1</sup>⁄<sub>3</sub>π{i('r')}²{i('h')}</>}>
            <path d="M30 70 L60 10 L90 70" {...S} />
            <path d="M30 70 A30 9 0 0 0 90 70" {...S} />
            <path d="M30 70 A30 9 0 0 1 90 70" {...S} strokeDasharray="4 3" strokeWidth={1} />
            <line x1="60" y1="10" x2="60" y2="70" {...S} strokeDasharray="4 3" strokeWidth={1} />
            <line x1="60" y1="70" x2="90" y2="70" {...S} strokeWidth={1} />
            <text x="72" y="66" {...T}>r</text>
            <text x="46" y="48" {...T}>h</text>
          </Fig>
          <Fig formula={<>{i('V')} = <sup>1</sup>⁄<sub>3</sub>{i('ℓwh')}</>}>
            <path d="M16 70 L74 70 L100 52 L58 12 Z M74 70 L58 12" {...S} />
            <path d="M16 70 L42 52 L100 52 M42 52 L58 12" {...S} strokeDasharray="4 3" strokeWidth={1} />
            <line x1="58" y1="12" x2="58" y2="61" {...S} strokeDasharray="4 3" strokeWidth={1} />
            <text x="42" y="84" {...T}>ℓ</text>
            <text x="90" y="70" {...T}>w</text>
            <text x="62" y="44" {...T}>h</text>
          </Fig>
        </div>
        <div className="mt-6 space-y-1.5 border-t border-neutral-200 pt-4 font-serif text-[15px] leading-relaxed">
          <p>The number of degrees of arc in a circle is 360.</p>
          <p>The number of radians of arc in a circle is 2π.</p>
          <p>The sum of the measures in degrees of the angles of a triangle is 180.</p>
        </div>
      </div>
    </FloatingPanel>
  )
}
