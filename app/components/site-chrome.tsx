import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { Link, NavLink, useLocation, useNavigationType, useRouteLoaderData } from 'react-router'
import { REPO_URL } from '~/lib/site'
import { cn } from '~/lib/utils'
import type { loader as rootLoader } from '~/root'
import { AccountMenu } from './console/account-menu'
import { ExternalLink } from './external-link'
import { GitHubIcon } from './icons'
import { ThemeSwitch } from './theme-toggle'
import { Button } from './ui/button'

/** The signed-in person, if any, as loaded by the root route. */
export function useViewer() {
  return useRouteLoaderData<typeof rootLoader>('root')?.viewer ?? null
}

/** The ids.pub mark: an open ring around a point. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      // The radius scales with the mark (7 of 32, as in the favicon), so it stays the same rounded
      // square at every size instead of turning into a circle when small.
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-[22%] bg-foreground text-background',
        className,
      )}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-[70%]" fill="none">
        <path
          d="M16 6 A 10 10 0 1 1 6 16"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="3.6" fill="currentColor" />
      </svg>
    </span>
  )
}

/** The brand, not text: it can't be selected or dragged. */
export function Wordmark() {
  return (
    <Link
      to="/"
      aria-label="ids.pub home"
      draggable={false}
      className="inline-flex shrink-0 select-none items-center gap-2 rounded-md"
    >
      <BrandMark />
      <span className="font-mono text-sm tracking-tight">
        <span className="font-semibold text-foreground">ids</span>
        <span className="text-muted-foreground">.pub</span>
      </span>
    </Link>
  )
}

/** A full page load: the route answers with a redirect to github.com, the only way in. */
export function LogInButton({ size = 'default' }: { size?: 'default' | 'lg' }) {
  return (
    <Button asChild size={size} className={size === 'lg' ? 'h-11 px-5 text-[15px]' : 'px-3'}>
      <Link to="/auth/github" reloadDocument>
        Log in
      </Link>
    </Button>
  )
}

const NAV = [
  { to: '/keys', label: 'Keys' },
  { to: '/groups', label: 'Groups' },
  { to: '/map', label: 'Map' },
  { to: '/guide', label: 'Guide' },
]

/** One header on every page, at one width: the brand, the console pages, and the account menu. */
export function SiteHeader({ showLogIn = true }: { showLogIn?: boolean }) {
  const viewer = useViewer()

  return (
    <header className="shrink-0 border-b bg-background">
      <div className="container-page flex h-14 items-center">
        <Wordmark />
        {viewer?.name ? (
          <nav aria-label="Console" className="ml-4 flex items-center gap-3 sm:ml-12 sm:gap-8">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                prefetch="intent"
                className="select-none text-muted-foreground text-sm transition-colors hover:text-foreground aria-[current=page]:text-foreground"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
        {/* One thing on the right: who is logged in, or the way to log in. */}
        <div className="ml-auto flex items-center">
          {viewer ? (
            <AccountMenu name={viewer.name} githubId={viewer.githubId} />
          ) : showLogIn ? (
            <LogInButton />
          ) : null}
        </div>
      </div>
    </header>
  )
}

/**
 * The home page's end: the source on GitHub, and the theme for those not logged in. Only the home
 * page has it; elsewhere the theme is in the account menu. A rule above it ends the page, as the
 * header's begins it.
 */
function SiteFooter() {
  return (
    <footer className="container-page w-full text-muted-foreground text-sm">
      <div className="flex h-16 items-center justify-between border-t">
        <ExternalLink
          href={REPO_URL}
          className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
        >
          <GitHubIcon className="size-4" />
          GitHub
        </ExternalLink>
        <ThemeSwitch />
      </div>
    </footer>
  )
}

/** Scroll positions by history entry, so Back returns to where the page was. */
const positions = new Map<string, number>()

/**
 * Every page: the header stays put and only what is under it scrolls. A new page starts at the top;
 * going back restores where it was.
 */
export function PageShell({
  children,
  banner,
  showLogIn,
  className,
  footer = false,
}: {
  children: ReactNode
  /** A notice above the header. */
  banner?: ReactNode
  showLogIn?: boolean
  /** For the column the page sits in, such as its padding. */
  className?: string
  /** The GitHub link and theme at the end: the home page's alone. */
  footer?: boolean
}) {
  const main = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigationType = useNavigationType()
  const lastPath = useRef(location.pathname)

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per history entry
  useLayoutEffect(() => {
    const element = main.current
    if (!element) return
    if (navigationType === 'POP') element.scrollTop = positions.get(location.key) ?? 0
    else if (lastPath.current !== location.pathname) element.scrollTop = 0
    lastPath.current = location.pathname
    const remember = () => positions.set(location.key, element.scrollTop)
    element.addEventListener('scroll', remember, { passive: true })
    return () => element.removeEventListener('scroll', remember)
  }, [location.key])

  return (
    <div className="flex h-dvh flex-col">
      {banner}
      <SiteHeader showLogIn={showLogIn} />
      <main
        ref={main}
        id="main"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges]"
      >
        {/* At least as tall as the window, so a short page still ends with its footer at the bottom. */}
        <div className="flex min-h-full flex-col">
          <div className={cn('container-page flex-1 pt-8 pb-24 sm:pt-10', className)}>
            {children}
          </div>
          {footer ? <SiteFooter /> : null}
        </div>
      </main>
    </div>
  )
}
