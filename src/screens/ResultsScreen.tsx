import { ArrowLeft, Bookmark, Check, ChevronLeft, ChevronRight, Home, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BlockView, blocksText } from '@/components/bluebook/BlockView'
import { formatClock } from '@/components/bluebook/Header'
import { QuestionPane } from '@/components/bluebook/QuestionPane'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isCorrect, summarize, type Tally } from '@/lib/scoring'
import { questionMap, sectionLabel, useApp } from '@/lib/store'
import type { Question } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'incorrect' | 'marked'

export function ResultsScreen() {
  const set = useApp((s) => s.set)
  const modules = useApp((s) => s.modules)
  const states = useApp((s) => s.states)
  const settings = useApp((s) => s.settings)
  const reviewing = useApp((s) => s.reviewing)
  const { setReviewing, start, exit } = useApp.getState()
  const [filter, setFilter] = useState<Filter>('all')

  const qmap = useMemo(() => questionMap(set), [set])
  // Questions in the order they were taken.
  const taken = useMemo(() => modules.flatMap((m) => m.questionIds.map((id) => qmap.get(id)).filter((q): q is Question => !!q)), [modules, qmap])
  const summary = useMemo(() => summarize(taken, states), [taken, states])
  const missed = taken.filter((q) => isCorrect(q, states[q.id]?.answer ?? null) === false)
  const visible = taken.filter((q) => {
    if (filter === 'incorrect') return isCorrect(q, states[q.id]?.answer ?? null) === false
    if (filter === 'marked') return states[q.id]?.marked
    return true
  })

  if (reviewing) {
    const i = visible.findIndex((q) => q.id === reviewing)
    const list = i >= 0 ? visible : taken
    const idx = list.findIndex((q) => q.id === reviewing)
    return (
      <ReviewQuestion
        q={list[idx]}
        number={taken.findIndex((q) => q.id === reviewing) + 1}
        onBack={() => setReviewing(null)}
        onPrev={idx > 0 ? () => setReviewing(list[idx - 1].id) : undefined}
        onNext={idx < list.length - 1 ? () => setReviewing(list[idx + 1].id) : undefined}
      />
    )
  }

  const pct = (t: Tally) => (t.total ? Math.round((t.correct / t.total) * 100) : 0)

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="text-lg font-bold">Your results</span>
          <div className="ml-auto flex gap-2">
            {missed.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => start(settings, missed.map((q) => q.id))}>
                <RotateCcw /> Retry {missed.length} missed
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => start(settings, taken.map((q) => q.id))}>
              <RotateCcw /> Retake all
            </Button>
            <Button size="sm" onClick={exit}>
              <Home /> Home
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Score" value={summary.graded ? `${summary.overall.correct}/${summary.overall.total}` : 'n/a'} sub={summary.graded ? `${pct(summary.overall)}% correct` : 'No answer key in this PDF'} />
          {(['rw', 'math'] as const).map((s) =>
            summary.bySection[s] ? (
              <Stat key={s} label={sectionLabel(s)} value={`${summary.bySection[s]!.correct}/${summary.bySection[s]!.total}`} sub={`${pct(summary.bySection[s]!)}% correct`} />
            ) : null,
          )}
          <Stat label="Time used" value={formatClock(summary.totalTime)} sub={`${taken.length ? Math.round(summary.totalTime / taken.length) : 0}s per question on average`} />
        </div>

        {summary.graded && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By skill</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(summary.bySkill)
                  .sort((a, b) => pct(a[1]) - pct(b[1]))
                  .map(([skill, t]) => (
                    <Bar key={skill} label={skill} sub={t.domain} t={t} />
                  ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By difficulty</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['Easy', 'Medium', 'Hard', ...Object.keys(summary.byDifficulty).filter((d) => !['Easy', 'Medium', 'Hard'].includes(d))]
                  .filter((d) => summary.byDifficulty[d])
                  .map((d) => (
                    <Bar key={d} label={d} t={summary.byDifficulty[d]} />
                  ))}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Questions</CardTitle>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                <TabsTrigger value="all">All ({taken.length})</TabsTrigger>
                <TabsTrigger value="incorrect">Incorrect ({missed.length})</TabsTrigger>
                <TabsTrigger value="marked">Marked ({taken.filter((q) => states[q.id]?.marked).length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="hidden md:table-cell">Skill</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Correct</TableHead>
                  <TableHead>Yours</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((q) => {
                  const st = states[q.id]
                  const ok = isCorrect(q, st?.answer ?? null)
                  return (
                    <TableRow key={q.id} className="cursor-pointer" onClick={() => setReviewing(q.id)}>
                      <TableCell className="font-medium">{taken.indexOf(q) + 1}</TableCell>
                      <TableCell className="max-w-[18rem]">
                        <div className="flex items-center gap-2">
                          {st?.marked && <Bookmark className="size-3.5 shrink-0 fill-bb-red text-bb-red" />}
                          <span className="truncate text-sm">{preview(q)}</span>
                        </div>
                        <div className="text-xs text-neutral-500">ID {q.id}</div>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">{q.skill}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(q.difficulty === 'Hard' && 'border-red-200 text-red-700', q.difficulty === 'Easy' && 'border-emerald-200 text-emerald-700')}>
                          {q.difficulty || 'n/a'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{q.correct?.join(', ') ?? 'n/a'}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1 font-semibold', ok === true && 'text-emerald-700', ok === false && 'text-bb-red')}>
                          {ok === true && <Check className="size-4" />}
                          {ok === false && <X className="size-4" />}
                          {st?.answer ?? 'Omitted'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatClock(st?.timeSpent ?? 0)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function preview(q: Question): string {
  return (blocksText(q.stimulus) || blocksText(q.prompt)).slice(0, 120) || `${q.skill || 'Math'} question`
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-neutral-500">{label}</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-neutral-500">{sub}</div>
      </CardContent>
    </Card>
  )
}

function Bar({ label, sub, t }: { label: string; sub?: string; t: Tally }) {
  const p = t.total ? (t.correct / t.total) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">
          {label} {sub && <span className="font-normal text-neutral-500">· {sub}</span>}
        </span>
        <span className="tabular-nums text-neutral-600">
          {t.correct}/{t.total}
        </span>
      </div>
      <Progress value={p} className="mt-1.5 h-2" />
    </div>
  )
}

function ReviewQuestion({ q, number, onBack, onPrev, onNext }: { q: Question; number: number; onBack(): void; onPrev?: () => void; onNext?: () => void }) {
  const st = useApp((s) => s.states[q.id])
  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-bb-chrome px-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft /> Results
        </Button>
        <span className="truncate text-sm font-semibold">
          {sectionLabel(q.section)} · {q.domain} · {q.skill} · {q.difficulty}
        </span>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="icon-sm" disabled={!onPrev} onClick={onPrev} aria-label="Previous question">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={!onNext} onClick={onNext} aria-label="Next question">
            <ChevronRight />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {q.stimulus.length > 0 && (
          <section className="shrink-0 border-b px-4 py-8 sm:px-8 md:w-1/2 md:overflow-y-auto md:border-r md:border-b-0">
            <div className="mx-auto max-w-[44rem]">
              <BlockView blocks={q.stimulus} />
            </div>
          </section>
        )}
        <section className="flex-1 px-4 py-8 sm:px-8 md:overflow-y-auto">
          <QuestionPane key={q.id} q={q} state={st} number={number} reveal annotate={false} />
        </section>
      </div>
    </div>
  )
}
