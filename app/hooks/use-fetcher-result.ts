import { useEffect, useRef } from 'react'

/** Calls `onResult` once for each response a fetcher gets back, however often the page re-renders. */
export function useFetcherResult<T>(
  fetcher: { state: string; data?: T },
  onResult: (data: T) => void,
) {
  const handled = useRef<T | undefined>(undefined)
  const callback = useRef(onResult)
  useEffect(() => {
    callback.current = onResult
  })
  useEffect(() => {
    if (fetcher.state !== 'idle' || fetcher.data === undefined || fetcher.data === handled.current)
      return
    handled.current = fetcher.data
    callback.current(fetcher.data)
  }, [fetcher.state, fetcher.data])
}
