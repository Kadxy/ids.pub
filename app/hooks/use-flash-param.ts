import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

/** Reads a one-time message passed through a redirect (?deleted=laptop), then removes it from the URL. */
export function useFlashParam(name: string, onFlash: (value: string) => void) {
  const [params, setParams] = useSearchParams()
  const value = params.get(name)
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once per value
  useEffect(() => {
    if (value === null) return
    onFlash(value)
    const next = new URLSearchParams(params)
    next.delete(name)
    setParams(next, { replace: true })
  }, [value])
}
