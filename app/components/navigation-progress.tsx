import { useEffect, useState } from 'react'
import { useNavigation } from 'react-router'
import { cn } from '~/lib/utils'

/**
 * A hairline along the top while a page loads. It waits a moment before appearing, so fast
 * navigations show nothing at all, and slow ones still show that something is happening.
 */
export function NavigationProgress() {
  const busy = useNavigation().state !== 'idle'
  const [phase, setPhase] = useState<'idle' | 'running' | 'finishing'>('idle')

  useEffect(() => {
    if (busy) {
      const timer = setTimeout(() => setPhase('running'), 150)
      return () => clearTimeout(timer)
    }
    setPhase((current) => (current === 'running' ? 'finishing' : 'idle'))
  }, [busy])

  useEffect(() => {
    if (phase !== 'finishing') return
    const timer = setTimeout(() => setPhase('idle'), 350)
    return () => clearTimeout(timer)
  }, [phase])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        className={cn(
          'h-full origin-left bg-foreground/70 motion-reduce:transition-none',
          phase === 'idle' && 'scale-x-0 opacity-0',
          phase === 'running' && 'scale-x-[0.85] transition-transform duration-[4s] ease-out',
          phase === 'finishing' &&
            'scale-x-100 opacity-0 transition-[transform,opacity] duration-300 ease-out',
        )}
      />
    </div>
  )
}
