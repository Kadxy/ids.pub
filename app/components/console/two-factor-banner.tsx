import { ShieldAlertIcon, XIcon } from 'lucide-react'
import { useFetcher } from 'react-router'
import { ExternalLink } from '~/components/external-link'

/** A site-wide notice above the header. Hiding it lasts 30 days, then it asks again. */
export function TwoFactorBanner() {
  const fetcher = useFetcher()
  if (fetcher.state !== 'idle' || fetcher.data) return null

  return (
    <section
      aria-label="Security notice"
      className="border-caution-border border-b bg-caution-surface text-caution"
    >
      <div className="container-page flex items-center gap-3 py-2 text-[13px]">
        <ShieldAlertIcon aria-hidden="true" className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          Your GitHub account has no two-factor authentication, so your keys are only as safe as its
          password.{' '}
          <ExternalLink
            href="https://github.com/settings/security"
            className="whitespace-nowrap font-medium underline underline-offset-4"
          >
            Turn it on
          </ExternalLink>
        </p>
        <fetcher.Form method="post" action="/keys/hide-two-factor-notice">
          <button
            type="submit"
            aria-label="Hide for 30 days"
            title="Hide for 30 days"
            className="-mr-1.5 grid size-7 shrink-0 place-items-center rounded-md hover:bg-caution/10"
          >
            <XIcon className="size-4" />
          </button>
        </fetcher.Form>
      </div>
    </section>
  )
}
