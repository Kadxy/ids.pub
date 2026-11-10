import { useEffect } from 'react'
import {
  Outlet,
  redirect,
  type ShouldRevalidateFunction,
  useLocation,
  useMatches,
  useRevalidator,
} from 'react-router'
import { TwoFactorBanner } from '~/components/console/two-factor-banner'
import { PageShell } from '~/components/site-chrome'
import { accountContext, envOf, viewerContext } from '~/context'
import { HIDE_2FA_COOKIE, isSameOrigin, readCookie } from '~/lib/auth.server'
import { rememberPage, takeStale } from '~/lib/page-cache'
import type { Route } from './+types/console-layout'

/**
 * Every console page and action runs behind this: no session goes to GitHub login, no name goes to
 * the welcome page, and anything that changes data must come from our own origin.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const env = envOf(context)
    if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOrigin(request, env)) {
      throw new Response('Forbidden', { status: 403 })
    }
    const viewer = context.get(viewerContext)
    if (!viewer) throw redirect('/auth/github')
    if (!viewer.account) throw redirect('/welcome')
    context.set(accountContext, viewer.account)
    return next()
  },
]

export async function loader({ request, context }: Route.LoaderArgs) {
  const account = context.get(accountContext)
  return {
    showTwoFactor:
      account.github.twoFactor === false && readCookie(request, HIDE_2FA_COOKIE) !== '1',
  }
}

/** Only the two-factor notice lives here, and only hiding it changes it. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formAction }) =>
  Boolean(formAction?.endsWith('/hide-two-factor-notice'))

/**
 * The page cache's other half: remember what each page shows, and when one was just shown from the
 * cache, fetch it again quietly. Only the page itself reloads; the layout and the root never do
 * without a form.
 */
function useRefreshCachedPages() {
  const matches = useMatches()
  const page = matches[matches.length - 1]
  const location = useLocation()
  const revalidator = useRevalidator()
  const data = page?.loaderData
  useEffect(() => {
    rememberPage(location.pathname, data)
  }, [data, location.pathname])
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per visit to a page
  useEffect(() => {
    if (takeStale(location.pathname)) void revalidator.revalidate()
  }, [location.key])
}

export default function ConsoleLayout({ loaderData }: Route.ComponentProps) {
  useRefreshCachedPages()
  return (
    <PageShell banner={loaderData.showTwoFactor ? <TwoFactorBanner /> : null}>
      <Outlet />
    </PageShell>
  )
}
