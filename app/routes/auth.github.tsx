import { redirect } from 'react-router'
import { envOf, viewerContext } from '~/context'
import { startGitHubSignIn, wantedNameCookie } from '~/lib/auth.server'
import { isClaimableName, normalizeName } from '~/lib/names'
import type { Route } from './+types/auth.github'

/**
 * Sign in with GitHub. Someone already signed in goes straight to their keys. `?name=` is a name
 * picked on the home page; the welcome page offers it after GitHub sends them back.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  if (context.get(viewerContext)) throw redirect('/keys')
  const env = envOf(context)
  const response = await startGitHubSignIn(env)
  const wanted = normalizeName(new URL(request.url).searchParams.get('name') ?? '')
  if (isClaimableName(wanted)) response.headers.append('set-cookie', wantedNameCookie(env, wanted))
  return response
}
