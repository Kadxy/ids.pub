import { HIDE_2FA_COOKIE } from '~/lib/auth.server'
import { forgettingAction } from '~/lib/page-cache'
import type { Route } from './+types/keys.hide-two-factor-notice'

const HIDE_DAYS = 30

/** Remembers, for 30 days, that the two-factor notice was dismissed in this browser. */
export async function action(_: Route.ActionArgs) {
  return Response.json(
    { hidden: true },
    {
      headers: {
        'set-cookie': `${HIDE_2FA_COOKIE}=1; Path=/; Max-Age=${HIDE_DAYS * 86_400}; SameSite=Lax`,
      },
    },
  )
}

/** Changes data, so the page cache forgets everything first; see ~/lib/page-cache. */
export const clientAction = (args: Route.ClientActionArgs) => forgettingAction(args)
