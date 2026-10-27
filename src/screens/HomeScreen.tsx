import { BookOpenCheck, Clock, ExternalLink, FileUp, Loader2, Play, Shield, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { deleteSet, listSets, loadSet, saveSet, type SetSummary } from '@/lib/library'
import { buildModules, DEFAULT_SETTINGS, sectionLabel, useApp } from '@/lib/store'
import type { Question, QuestionSet, TestSettings } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatClock } from '@/components/bluebook/Header'

const QB_URL = 'https://satsuiteeducatorquestionbank.collegeboard.org/digital/search'

export function HomeScreen() {
  const set = useApp((s) => s.set)
  const savedSettings = useApp((s) => s.settings)
  const [settings, setSettings] = useState<TestSettings>({ ...DEFAULT_SETTINGS, ...savedSettings })
  const [busy, setBusy] = useState<{ file: string; done: number; total: number } | null>(null)
  const [library, setLibrary] = useState<SetSummary[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listSets().then(setLibrary)
  }, [])

  const handleFiles = async (files: FileList | File[]) => {
    const pdfs = [...files].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) return toast.error('Please choose a PDF exported from the SAT Suite Question Bank.')
    const { parseQuestionBankPdf } = await import('@/lib/pdf/parse')
    const all: Question[] = []
    for (const f of pdfs) {
      try {
        setBusy({ file: f.name, done: 0, total: 1 })
        const qs = await parseQuestionBankPdf(await f.arrayBuffer(), (done, total) => setBusy({ file: f.name, done, total }))
        all.push(...qs)
      } catch (e) {
        console.error(e)
        toast.error(`${f.name}: ${e instanceof Error ? e.message : 'could not be read.'}`)
      }
    }
    setBusy(null)
    if (all.length === 0) return
    const merged = mergeById(all)
    const qs: QuestionSet = {
      id: crypto.randomUUID(),
      name: pdfs.length === 1 ? pdfs[0].name.replace(/\.pdf$/i, '') : `${pdfs.length} PDFs`,
      createdAt: Date.now(),
      questions: merged,
    }
    useApp.getState().loadSet(qs)
    await saveSet(qs)
    setLibrary(await listSets())
    toast.success(`Loaded ${merged.length} question${merged.length === 1 ? '' : 's'}.`)
  }

  const openSaved = async (id: string) => {
    const qs = await loadSet(id)
    if (qs) useApp.getState().loadSet(qs)
    else toast.error('That set is no longer saved on this device.')
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#eef2fb_0%,#ffffff_420px)]">
      <header className="border-b border-neutral-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <div className="grid size-8 place-items-center rounded-lg bg-bb-blue text-white">
            <BookOpenCheck className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Blankbook</span>
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-neutral-500 sm:flex">
            <Shield className="size-3.5" /> No account. PDFs are processed in your browser and never uploaded.
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-bb-ink sm:text-4xl">Practice in the Bluebook view.</h1>
            <p className="mt-2 max-w-2xl text-neutral-600">
              Export questions from the official{' '}
              <a href={QB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-bb-blue hover:underline">
                SAT Suite Question Bank <ExternalLink className="size-3.5" />
              </a>{' '}
              using <strong>“With correct answers and explanations”</strong>, drop the PDF here, and take it like test day.
            </p>
          </section>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (!busy) handleFiles(e.dataTransfer.files)
            }}
            className={cn(
              'relative rounded-2xl border-2 border-dashed bg-white p-8 text-center transition-colors',
              dragOver ? 'border-bb-blue bg-blue-50/60' : 'border-neutral-300',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            {busy ? (
              <div className="mx-auto max-w-sm space-y-3">
                <Loader2 className="mx-auto size-8 animate-spin text-bb-blue" />
                <p className="font-medium">Reading {busy.file}…</p>
                <Progress value={(busy.done / busy.total) * 100} />
                <p className="text-xs text-neutral-500">
                  Page {busy.done} of {busy.total}
                </p>
              </div>
            ) : (
              <>
                <FileUp className="mx-auto size-10 text-bb-blue" />
                <p className="mt-3 text-lg font-semibold">Drop question bank PDFs here</p>
                <p className="mt-1 text-sm text-neutral-500">Reading and Writing, Math, or both. Add several PDFs to combine them.</p>
                <Button className="mt-5 rounded-full px-6" onClick={() => inputRef.current?.click()}>
                  Choose PDF
                </Button>
              </>
            )}
          </div>

          {set && <SetPreview set={set} settings={settings} />}

          {library.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saved on this device</CardTitle>
                <CardDescription>Question sets you've uploaded before. Reopen one without uploading it again.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {library.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2.5">
                    <button className="min-w-0 flex-1 text-left" onClick={() => openSaved(s.id)}>
                      <div className={cn('truncate font-medium', set?.id === s.id && 'text-bb-blue')}>{s.name}</div>
                      <div className="text-xs text-neutral-500">
                        {s.count} questions · {s.sections.map((x) => sectionLabel(x as 'rw' | 'math')).join(' + ')} ·{' '}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                    <Button variant="outline" size="sm" onClick={() => openSaved(s.id)}>
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${s.name}`}
                      onClick={async () => {
                        await deleteSet(s.id)
                        setLibrary(await listSets())
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SettingsCard settings={settings} onChange={setSettings} disabled={!set} />
        </aside>
      </main>
    </div>
  )
}

function mergeById(qs: Question[]): Question[] {
  const byId = new Map<string, Question>()
  for (const q of qs) {
    const prev = byId.get(q.id)
    // A questions-only PDF plus an answers PDF of the same questions: keep the one with answers.
    if (!prev || (!prev.correct && q.correct)) byId.set(q.id, q)
  }
  return [...byId.values()]
}

function SetPreview({ set, settings }: { set: QuestionSet; settings: TestSettings }) {
  const modules = buildModules(set.questions, { ...settings, shuffle: false })
  const missingAnswers = set.questions.filter((q) => !q.correct).length
  const bySection = (['rw', 'math'] as const).map((s) => ({ s, n: set.questions.filter((q) => q.section === s).length })).filter((x) => x.n > 0)
  const difficulties = ['Easy', 'Medium', 'Hard'].map((d) => ({ d, n: set.questions.filter((q) => q.difficulty === d).length }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{set.name}</CardTitle>
        <CardDescription>
          {set.questions.length} questions ·{' '}
          {bySection.map((x) => `${x.n} ${sectionLabel(x.s)}`).join(', ')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {difficulties.map((x) => (
            <Badge key={x.d} variant="secondary">
              {x.d}: {x.n}
            </Badge>
          ))}
          {[...new Set(set.questions.map((q) => q.domain).filter(Boolean))].map((d) => (
            <Badge key={d} variant="outline">
              {d}
            </Badge>
          ))}
        </div>
        {missingAnswers > 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {missingAnswers} question{missingAnswers === 1 ? " doesn't" : "s don't"} include an answer key, so they can't be scored. Export with
            “With correct answers and explanations”, or add that PDF too.
          </p>
        )}
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Your test</div>
          <div className="space-y-1.5">
            {modules.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                <span>
                  Section {m.sectionNumber}, Module {m.moduleNumber}: {sectionLabel(m.section)}
                </span>
                <span className="flex items-center gap-3 text-neutral-600 tabular-nums">
                  <span>{m.questionIds.length} questions</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {m.seconds === null ? 'Untimed' : formatClock(m.seconds)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SettingsCard({ settings, onChange, disabled }: { settings: TestSettings; onChange(s: TestSettings): void; disabled: boolean }) {
  const set = <K extends keyof TestSettings>(k: K, v: TestSettings[K]) => onChange({ ...settings, [k]: v })
  const start = useApp((s) => s.start)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Test settings</CardTitle>
        <CardDescription>Applied when you start.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Timing</Label>
          <RadioGroup value={settings.timingMode} onValueChange={(v) => set('timingMode', v as TestSettings['timingMode'])} className="gap-2.5">
            <Option value="bluebook" label="Real SAT pace" hint="32 min per 27 Reading & Writing questions, 35 min per 22 Math (scaled to your set)" />
            <Option value="total" label="Total time">
              {settings.timingMode === 'total' && (
                <NumberField value={settings.totalMinutes} min={1} max={600} suffix="minutes" onChange={(v) => set('totalMinutes', v)} />
              )}
            </Option>
            <Option value="perQuestion" label="Time per question">
              {settings.timingMode === 'perQuestion' && (
                <div className="space-y-2">
                  <NumberField value={settings.secondsPerQuestion} min={10} max={900} suffix="seconds" onChange={(v) => set('secondsPerQuestion', v)} />
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={settings.autoAdvance} onCheckedChange={(v) => set('autoAdvance', v)} />
                    Move on automatically when time runs out
                  </label>
                </div>
              )}
            </Option>
            <Option value="untimed" label="Untimed" hint="The clock counts up instead." />
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Show correct answers</Label>
          <RadioGroup value={settings.feedback} onValueChange={(v) => set('feedback', v as TestSettings['feedback'])} className="gap-2.5">
            <Option value="end" label="All together at the end" hint="Like the real test. Review everything on the results page." />
            <Option value="immediate" label="After every question" hint="Click Check to see the answer and explanation, then move on." />
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-3">
          <Toggle checked={settings.shuffle} onChange={(v) => set('shuffle', v)} label="Shuffle question order" />
          <Toggle checked={settings.splitModules} onChange={(v) => set('splitModules', v)} label="Split into Bluebook-sized modules" hint="27 Reading and Writing / 22 Math per module" />
          <Toggle checked={settings.includeBreak} onChange={(v) => set('includeBreak', v)} label="10-minute break between sections" />
        </div>

        <Button size="lg" className="h-11 w-full rounded-full text-base" disabled={disabled} onClick={() => start(settings)}>
          <Play className="fill-current" /> Start practice
        </Button>
        {disabled && <p className="-mt-3 text-center text-xs text-neutral-500">Upload or open a question set first.</p>}
      </CardContent>
    </Card>
  )
}

function Option({ value, label, hint, children }: { value: string; label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 has-[[data-state=checked]]:border-bb-blue has-[[data-state=checked]]:bg-blue-50/40">
      <label className="flex cursor-pointer items-start gap-3">
        <RadioGroupItem value={value} className="mt-0.5" />
        <span className="flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
        </span>
      </label>
      {children && <div className="mt-2.5 pl-7">{children}</div>}
    </div>
  )
}

function NumberField({ value, min, max, suffix, onChange }: { value: number; min: number; max: number; suffix: string; onChange(v: number): void }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="h-8 w-24"
      />
      <span className="text-sm text-neutral-600">{suffix}</span>
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange(v: boolean): void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
