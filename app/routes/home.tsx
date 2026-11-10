import { useState } from 'react'
import { Link } from 'react-router'
import { type FanGroup, type FanKey, KeyFan } from '~/components/key-fan'
import { PageShell } from '~/components/site-chrome'
import { Button } from '~/components/ui/button'
import { SITE_HOST, SITE_ORIGIN } from '~/lib/site'
import type { Route } from './+types/home'

const TITLE = 'ids.pub: a home for your public keys'
const DESCRIPTION =
  'Every public key you use, at one address. Put keys in groups, and each group has an address of its own with only those keys. Open source.'

export const meta: Route.MetaFunction = () => [
  { title: TITLE },
  { name: 'description', content: DESCRIPTION },
  // How the page looks when its link is shared.
  { property: 'og:type', content: 'website' },
  { property: 'og:site_name', content: SITE_HOST },
  { property: 'og:url', content: `${SITE_ORIGIN}/` },
  { property: 'og:title', content: TITLE },
  { property: 'og:description', content: DESCRIPTION },
  { name: 'twitter:card', content: 'summary' },
  // What the site is, for search engines that read structured data.
  {
    'script:ld+json': {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_HOST,
      url: `${SITE_ORIGIN}/`,
      description: DESCRIPTION,
    },
  },
]

/**
 * The one address for this page, its plain markdown version, and the llms.txt that describes the
 * site (as https://llmstxt.org/ recommends linking them).
 */
export const links: Route.LinksFunction = () => [
  { rel: 'canonical', href: `${SITE_ORIGIN}/` },
  { rel: 'alternate', type: 'text/markdown', href: '/index.md' },
  { rel: 'describedby', href: '/llms.txt' },
]

/** Cryptography's Alice, and a reserved name (see ~/lib/names), so none of these addresses is anyone's. */
const NAME = 'alice'

/**
 * The example: five keys at alice's address, of the kinds people have. Phone is in no group,
 * Laptop and Work Mac in one, YubiKey and Deploy in two; the groups have two, one and three keys.
 * They sit in their own order, so some lines cross.
 */
const KEYS: FanKey[] = [
  { id: 'Laptop', name: 'Laptop', icon: 'laptop', type: 'Ed25519' },
  { id: 'YubiKey', name: 'YubiKey', icon: 'security-key', type: 'Ed25519-SK' },
  { id: 'Phone', name: 'Phone', icon: 'phone', type: 'Ed25519' },
  { id: 'Work Mac', name: 'Work Mac', icon: 'desktop', type: 'RSA 4096' },
  { id: 'Deploy', name: 'Deploy', icon: 'bot', type: 'RSA 3072' },
]
const GROUPS: FanGroup[] = [
  { id: 'home', name: 'home', keys: ['Laptop', 'YubiKey'] },
  { id: 'ci', name: 'ci', keys: ['Deploy'] },
  { id: 'prod', name: 'prod', keys: ['YubiKey', 'Work Mac', 'Deploy'] },
]
const ADDRESS = { id: NAME, name: NAME }

const POINTS = [
  {
    lead: 'Update your keys in one place.',
    more: 'Servers that read your address at each login stop accepting a key as soon as you remove it.',
  },
  {
    lead: 'Give each server only the keys it needs.',
    more: 'A server that reads a group’s address accepts the keys in that group and no others.',
  },
  {
    lead: 'Use the same keys beyond logins.',
    more: 'Git checks your signed commits against your address, and age encrypts files to the keys at it.',
  },
]

/**
 * The same for everyone, signed in or not, and nothing from the database: the headline and the way
 * in, a drawing of one person's keys and groups, and what that gives them.
 */
export default function Home() {
  return (
    <PageShell footer className="pt-16 sm:pt-24">
      {/*
        One line where it fits, sized to the column. Where it can't (phones), it breaks only
        between the two halves, each kept whole.
      */}
      <h1 className="font-semibold text-[38px] leading-[1.05] tracking-[-0.04em] sm:text-[min(54px,calc((100vw_-_4rem)*0.076))]">
        <span className="whitespace-nowrap">A home for your</span>{' '}
        <span className="whitespace-nowrap">public keys.</span>
      </h1>
      <div className="mt-8">
        <Button asChild size="lg" className="h-11 rounded-full px-6 text-[15px]">
          <Link to="/keys" reloadDocument>
            Get started
          </Link>
        </Button>
      </div>

      {/*
        The drawing in key-fan.tsx: alice's address over her keys, the groups under them. It rises
        in on arrival, and pointing at a box picks out its lines. Only a picture: the caption says it.
      */}
      <figure className="mt-20 select-none sm:mt-24">
        <div aria-hidden="true">
          <KeyFan address={ADDRESS} keys={KEYS} groups={GROUPS} intro />
        </div>
        <figcaption className="sr-only">
          An example. Laptop, YubiKey, Phone, Work Mac and Deploy are all at {SITE_HOST}/{NAME}. The
          group home has Laptop and YubiKey; ci has Deploy; prod has YubiKey, Work Mac and Deploy.
          Phone is in no group.
        </figcaption>
      </figure>

      <Points />
    </PageShell>
  )
}

/**
 * What it gives you. Where there is a mouse, all three are closed, each showing only what it
 * claims; pointing at one opens it, and moving off the list closes it again, and Tab opens the one
 * it reaches. On touch screens, where nothing can be pointed at, all three are simply open.
 */
function Points() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="mt-20 sm:mt-24">
      <h2 className="sr-only">What it gives you</h2>
      <ul
        className="grid gap-3 [@media(hover:hover)]:gap-1"
        onPointerLeave={() => setOpen(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null)
        }}
      >
        {POINTS.map((point, index) => (
          <li
            key={point.lead}
            // A list item, not a button: on touch it does nothing, and with a mouse it only shows.
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Tab reaches each point to open it
            tabIndex={0}
            data-open={open === index ? '' : undefined}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setOpen(index)
            }}
            onFocus={() => setOpen(index)}
            className="group py-1.5 text-[16px] leading-[1.6] outline-none focus-visible:underline focus-visible:decoration-faint focus-visible:underline-offset-4"
          >
            <span className="font-medium">{point.lead}</span>
            <span className="grid transition-[grid-template-rows,opacity] duration-300 ease-out [@media(hover:hover)]:grid-rows-[0fr] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-data-open:grid-rows-[1fr] [@media(hover:hover)]:group-data-open:opacity-100">
              <span className="overflow-hidden text-muted-foreground">{point.more}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
