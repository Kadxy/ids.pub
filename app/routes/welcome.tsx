import { useId, useState } from 'react'
import { data, Form, redirect, useActionData, useNavigation } from 'react-router'
import { NameStatus } from '~/components/name-status'
import { PageShell } from '~/components/site-chrome'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { envOf, viewerContext } from '~/context'
import { useNameCheck } from '~/hooks/use-name-check'
import { isSameOrigin, readCookie, WANTED_NAME_COOKIE, wantedNameCookie } from '~/lib/auth.server'
import { claimFirstName, isNameTaken } from '~/lib/db.server'
import { NAME_MAX_LENGTH, nameProblem, normalizeName, unavailable } from '~/lib/names'
import { forgettingAction } from '~/lib/page-cache'
import type { Route } from './+types/welcome'

export const meta: Route.MetaFunction = () => [{ title: 'Choose your username – ids.pub' }]

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = envOf(context)
  const account = context.get(viewerContext)?.row
  if (!account) throw redirect('/auth/github')
  if (account.name) throw redirect('/keys')

  // The name picked on the home page first, then the GitHub login, whichever is still free.
  const candidates = [
    new URL(request.url).searchParams.get('name'),
    readCookie(request, WANTED_NAME_COOKIE),
    account.github_login,
  ].map((raw) => normalizeName(raw ?? ''))
  for (const candidate of candidates) {
    if (candidate && !nameProblem(candidate) && !(await isNameTaken(env.DB, candidate))) {
      return { suggestion: candidate }
    }
  }
  return { suggestion: '' }
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = envOf(context)
  if (!isSameOrigin(request, env)) throw new Response('Forbidden', { status: 403 })
  const account = context.get(viewerContext)?.row
  if (!account) throw redirect('/auth/github')
  if (account.name) throw redirect('/keys')

  const name = normalizeName(String((await request.formData()).get('name') ?? ''))
  const problem = nameProblem(name)
  if (problem) return data({ name, error: problem }, { status: 400 })
  if ((await claimFirstName(env.DB, account.id, name)) === 'taken') {
    return data({ name, error: unavailable(name) }, { status: 409 })
  }
  return redirect('/keys', { headers: { 'set-cookie': wantedNameCookie(env, null) } })
}

/** Changes data, so the page cache forgets everything first; see ~/lib/page-cache. */
export const clientAction = (args: Route.ClientActionArgs) => forgettingAction(args)

export default function Welcome({ loaderData }: Route.ComponentProps) {
  const id = useId()
  const result = useActionData<typeof action>()
  const busy = useNavigation().state !== 'idle'
  const [value, setValue] = useState(result?.name ?? loaderData.suggestion)
  const check = useNameCheck(value)
  const serverError = result && normalizeName(value) === result.name ? result.error : null

  return (
    <PageShell>
      <div className="max-w-md">
        <h1 className="font-semibold text-[22px] tracking-[-0.015em]">Choose your username</h1>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Your keys will be at ids.pub/your-username. You can change it later.
        </p>
        <Form method="post" className="mt-6 grid gap-2">
          <label htmlFor={id} className="font-medium text-sm">
            Username
          </label>
          <Input
            id={id}
            name="name"
            value={value}
            onChange={(event) => setValue(event.target.value.toLowerCase())}
            maxLength={NAME_MAX_LENGTH}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="username"
            autoFocus
            className="h-10"
          />
          <div className="min-h-5">
            {serverError ? (
              <p className="text-destructive text-sm">{serverError}</p>
            ) : value ? (
              <NameStatus state={check} />
            ) : null}
          </div>
          <Button type="submit" className="mt-2 h-10" disabled={busy || check.status !== 'free'}>
            Continue
          </Button>
        </Form>
      </div>
    </PageShell>
  )
}
