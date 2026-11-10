import { data, isRouteErrorResponse, Link } from 'react-router'
import { PageShell } from '~/components/site-chrome'
import { Button } from '~/components/ui/button'
import { envOf } from '~/context'
import { finishGitHubSignIn, type SignInFailure, startSession } from '~/lib/auth.server'
import { upsertGitHubAccount } from '~/lib/db.server'
import type { Route } from './+types/auth.github.callback'

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envOf(context)
  let result: Awaited<ReturnType<typeof finishGitHubSignIn>>
  try {
    result = await finishGitHubSignIn(request, env)
  } catch (failure) {
    if (typeof failure === 'string') throw data(failure as SignInFailure, { status: 400 })
    throw failure
  }

  const account = await upsertGitHubAccount(env.DB, result.user)
  const headers = new Headers({
    location: account.name ? '/keys' : '/welcome',
    'cache-control': 'no-store',
  })
  headers.append('set-cookie', result.clearOAuthCookie)
  headers.append('set-cookie', await startSession(env, account.id))
  return new Response(null, { status: 302, headers })
}

const MESSAGES: Record<SignInFailure, string> = {
  denied: 'You cancelled on GitHub, so you are not logged in.',
  expired: 'This login link expired or was opened in another browser. Start again from here.',
  github: "GitHub didn't confirm who you are. Try again in a moment.",
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const failure = isRouteErrorResponse(error) ? (error.data as SignInFailure) : 'github'
  return (
    <PageShell showLogIn={false} className="py-24">
      <h1 className="font-semibold text-xl">Login didn't finish</h1>
      <p className="mt-2 text-muted-foreground">{MESSAGES[failure] ?? MESSAGES.github}</p>
      <Button asChild className="mt-6">
        <Link to="/auth/github" reloadDocument>
          Log in
        </Link>
      </Button>
    </PageShell>
  )
}
