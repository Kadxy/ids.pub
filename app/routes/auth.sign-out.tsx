import { redirect } from 'react-router'
import { envOf } from '~/context'
import { endSession, isSameOrigin } from '~/lib/auth.server'
import { forgettingAction } from '~/lib/page-cache'
import type { Route } from './+types/auth.sign-out'

export async function action({ request, context }: Route.ActionArgs) {
  const env = envOf(context)
  if (!isSameOrigin(request, env)) throw new Response('Forbidden', { status: 403 })
  return redirect('/', { headers: { 'set-cookie': await endSession(request, env) } })
}

/** Changes data, so the page cache forgets everything first; see ~/lib/page-cache. */
export const clientAction = (args: Route.ClientActionArgs) => forgettingAction(args)

export const loader = () => redirect('/')
