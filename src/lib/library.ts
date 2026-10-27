// Question sets live in IndexedDB (they contain image crops, too big for localStorage).
// Everything stays in this browser; nothing is uploaded anywhere.
import { del, get, set } from 'idb-keyval'
import type { QuestionSet } from './types'

export interface SetSummary {
  id: string
  name: string
  createdAt: number
  count: number
  sections: string[]
}

/** Bump when the parsed Question shape changes; older saved sets are ignored. */
const VERSION = 2
const INDEX = `sets:v${VERSION}:index`
const key = (id: string) => `set:v${VERSION}:${id}`

export async function listSets(): Promise<SetSummary[]> {
  try {
    return ((await get<SetSummary[]>(INDEX)) ?? []).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export async function saveSet(qs: QuestionSet): Promise<void> {
  try {
    await set(key(qs.id), qs)
    const index = (await get<SetSummary[]>(INDEX)) ?? []
    const summary: SetSummary = {
      id: qs.id,
      name: qs.name,
      createdAt: qs.createdAt,
      count: qs.questions.length,
      sections: [...new Set(qs.questions.map((q) => q.section))],
    }
    await set(INDEX, [summary, ...index.filter((s) => s.id !== qs.id)].slice(0, 30))
  } catch {
    // Private mode or storage disabled: the set still works for this session.
  }
}

export async function loadSet(id: string): Promise<QuestionSet | null> {
  try {
    return (await get<QuestionSet>(key(id))) ?? null
  } catch {
    return null
  }
}

export async function deleteSet(id: string): Promise<void> {
  try {
    await del(key(id))
    const index = (await get<SetSummary[]>(INDEX)) ?? []
    await set(INDEX, index.filter((s) => s.id !== id))
  } catch {
    // ignore
  }
}
