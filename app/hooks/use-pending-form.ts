import { useFetchers } from 'react-router'

/**
 * The form data of a submission with this intent that is still on its way, from any fetcher.
 * Pages render it in place of what they loaded, so a change shows up before the server confirms it.
 */
export function usePendingForm(intent: string): FormData | undefined {
  return useFetchers().find((fetcher) => fetcher.formData?.get('intent') === intent)?.formData
}
