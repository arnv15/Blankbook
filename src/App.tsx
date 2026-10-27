import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { loadSet } from '@/lib/library'
import { useApp } from '@/lib/store'
import { BreakScreen } from '@/screens/BreakScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { ResultsScreen } from '@/screens/ResultsScreen'
import { TestScreen } from '@/screens/TestScreen'

export default function App() {
  const screen = useApp((s) => s.screen)
  const set = useApp((s) => s.set)
  const [restoring, setRestoring] = useState(() => !!useApp.getState().setId)

  // Progress is persisted in localStorage, the question set in IndexedDB: reunite them after a reload.
  useEffect(() => {
    const { setId, set } = useApp.getState()
    if (!setId || set) return setRestoring(false)
    loadSet(setId).then((qs) => {
      if (qs) useApp.getState().loadSet(qs)
      else useApp.setState({ screen: 'home', setId: null })
      setRestoring(false)
    })
  }, [])

  let body: React.ReactNode
  if (restoring) {
    body = (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin text-bb-blue" />
      </div>
    )
  } else if (screen === 'home' || !set) body = <HomeScreen />
  else if (screen === 'test') body = <TestScreen />
  else if (screen === 'break') body = <BreakScreen />
  else body = <ResultsScreen />

  return (
    <TooltipProvider>
      {body}
      <Toaster theme="light" position="top-center" />
    </TooltipProvider>
  )
}
