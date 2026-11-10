import { data, isRouteErrorResponse, redirect } from 'react-router'
import { Command } from '~/components/command'
import { FingerprintPopover } from '~/components/fingerprint-popover'
import { KeyAvatar } from '~/components/key-avatar'
import { LogInButton, PageShell, useViewer } from '~/components/site-chrome'
import { Card } from '~/components/ui/card'
import { envOf, viewerContext } from '~/context'
import { d1Directory } from '~/lib/db.server'
import { keyTitle } from '~/lib/directory'
import { factsFor } from '~/lib/key-facts'
import { isClaimableName, normalizeName } from '~/lib/names'
import { addressPath, curlCommand, displayAddress, SITE_HOST } from '~/lib/site'
import type { Route } from './+types/profile'

type Problem =
  | { kind: 'missing'; name: string; claimable: boolean }
  | { kind: 'gone'; name: string }

export async function loader({ params, context }: Route.LoaderArgs) {
  const name = normalizeName(params.name)
  if (params.name !== name) throw redirect(addressPath(name), 301)

  const lookup = await d1Directory(envOf(context).DB).lookup(name)
  if (lookup.kind === 'missing') {
    throw data<Problem>(
      { kind: 'missing', name, claimable: isClaimableName(name) },
      { status: 404 },
    )
  }
  if (lookup.kind === 'gone') throw data<Problem>({ kind: 'gone', name }, { status: 410 })

  const { account } = lookup
  // People following an earlier name land on the current one; machines never see this redirect.
  if (account.name !== name) throw redirect(addressPath(account.name), 302)

  const own = context.get(viewerContext)?.row.id === account.id
  // A private profile tells people only that the username is taken. Its owner sees it all.
  if (account.private && !own) {
    return { name, hidden: true as const, own, github: null, keys: [] }
  }

  const describe = async (key: (typeof account.keys)[number]) => {
    const facts = await factsFor(key.type, key.base64)
    return {
      id: key.id,
      title: keyTitle(key, facts.algorithm),
      untitled: !key.name.trim() && !key.comment.trim(),
      icon: key.icon,
      facts,
    }
  }
  const keys = await Promise.all(account.keys.map(describe))

  return {
    name,
    hidden: false as const,
    own: own && account.private,
    github: { id: account.github.id },
    keys,
  }
}

/** A person's page is theirs to share, not for search engines to list: every state is noindex. */
const NOINDEX = { name: 'robots', content: 'noindex' }

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) return [{ title: SITE_HOST }, NOINDEX]
  const address = displayAddress(loaderData.name)
  const count = loaderData.keys.length
  if (loaderData.hidden) return [{ title: address }, NOINDEX]
  return [
    { title: address },
    NOINDEX,
    {
      name: 'description',
      content: `${count} SSH public ${count === 1 ? 'key' : 'keys'} at ${address}.`,
    },
  ]
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { name, github, keys } = loaderData
  return (
    <Page>
      {loaderData.own ? (
        <p className="mb-6 rounded-lg bg-muted px-3 py-2 text-muted-foreground text-sm">
          Private. Only you can see this page.
        </p>
      ) : null}
      <section className="flex items-center gap-4">
        {github ? (
          <img
            src={`https://avatars.githubusercontent.com/u/${github.id}?s=128&v=4`}
            alt=""
            width={56}
            height={56}
            draggable={false}
            className="size-14 shrink-0 rounded-full bg-muted ring-1 ring-foreground/10"
          />
        ) : null}
        <h1 className="min-w-0 font-semibold text-[26px] leading-8 tracking-[-0.02em] [overflow-wrap:anywhere]">
          {name}
        </h1>
      </section>

      {loaderData.hidden ? (
        <p className="mt-3 text-muted-foreground text-sm">This profile is private.</p>
      ) : (
        <>
          {/* A private account returns nothing, so there is no command to show. */}
          {loaderData.own ? null : (
            <div className="mt-6">
              <Command value={curlCommand(name)} />
            </div>
          )}

          <section className="mt-8">
            <h2 className="mb-2 font-medium text-sm">
              {keys.length} {keys.length === 1 ? 'key' : 'keys'}
            </h2>
            {keys.length === 0 ? (
              <p className="text-muted-foreground text-sm">No keys yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card">
                <div
                  aria-hidden="true"
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b bg-muted/40 px-4 py-2 text-faint text-xs sm:grid-cols-[minmax(0,1fr)_25.5rem]"
                >
                  <span>Name</span>
                  <span>Fingerprint</span>
                </div>
                <ul className="divide-y">
                  {keys.map((key) => (
                    <li
                      key={key.id}
                      className="grid h-12 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 px-4 text-sm sm:grid-cols-[minmax(0,1fr)_25.5rem]"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <KeyAvatar icon={key.icon} size="sm" />
                        <span
                          title={key.title}
                          className={`truncate font-medium ${key.untitled ? 'text-muted-foreground' : ''}`}
                        >
                          {key.title}
                        </span>
                      </span>
                      <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                        <span
                          title={key.facts.fingerprint}
                          className="truncate font-mono text-[12.5px]"
                        >
                          {key.facts.fingerprint}
                        </span>
                        <FingerprintPopover
                          name={key.title}
                          facts={key.facts}
                          withFingerprint={false}
                          small
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const viewer = useViewer()
  const problem = isRouteErrorResponse(error) ? (error.data as Problem | null) : null
  if (!problem) throw error

  const address = displayAddress(problem.name)
  return (
    <Page>
      <Card className="items-center px-6 py-12 text-center">
        <p className="font-mono text-muted-foreground text-sm">{address}</p>
        {problem.kind === 'missing' && problem.claimable ? (
          <>
            <h1 className="font-semibold text-xl tracking-tight">No one has this name yet</h1>
            {viewer ? null : (
              <div className="mt-2">
                <LogInButton />
              </div>
            )}
          </>
        ) : null}
        {problem.kind === 'missing' && !problem.claimable ? (
          <>
            <h1 className="font-semibold text-xl tracking-tight">This name isn't available</h1>
            <p className="max-w-sm text-muted-foreground text-sm">
              {SITE_HOST} uses this word for its own pages.
            </p>
          </>
        ) : null}
        {problem.kind === 'gone' ? (
          <>
            <h1 className="font-semibold text-xl tracking-tight">This name is retired</h1>
            <p className="max-w-sm text-muted-foreground text-sm">
              It returns no keys and can never be claimed.
            </p>
          </>
        ) : null}
      </Card>
    </Page>
  )
}
