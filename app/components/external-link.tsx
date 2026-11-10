import type { ComponentProps } from 'react'

/**
 * A link that leaves ids.pub: it opens in a new tab, so the page it was followed from stays where
 * it was. noopener keeps the other site from reaching back into this one.
 */
export function ExternalLink(props: Omit<ComponentProps<'a'>, 'target' | 'rel'>) {
  return <a target="_blank" rel="noopener noreferrer" {...props} />
}
