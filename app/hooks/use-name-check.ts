import { useEffect } from 'react'
import { useFetcher } from 'react-router'
import { nameProblem, normalizeName } from '~/lib/names'
import type { NameCheck } from '~/routes/names.check'

export type NameState =
  | { status: 'empty' }
  | { status: 'problem'; problem: string }
  | { status: 'checking' }
  | NameCheck

/**
 * Whether a name is free, checked as it is typed. Shape problems are answered here at once; the
 * server is asked only about well-formed names, once typing pauses.
 */
export function useNameCheck(raw: string, delay = 250): NameState {
  const fetcher = useFetcher<NameCheck>()
  const name = normalizeName(raw)
  const problem = name === '' ? null : nameProblem(name)
  const load = fetcher.load

  useEffect(() => {
    if (name === '' || problem) return
    const timer = setTimeout(() => load(`/-/names/${name}`), delay)
    return () => clearTimeout(timer)
  }, [name, problem, delay, load])

  if (name === '') return { status: 'empty' }
  if (problem) return { status: 'problem', problem }
  if (fetcher.data?.name === name && fetcher.state === 'idle') return fetcher.data
  return { status: 'checking' }
}
