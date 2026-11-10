import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  type ShouldRevalidateFunction,
  useRouteLoaderData,
} from 'react-router'
import type { Route } from './+types/root'
import './app.css'
import { NavigationProgress } from './components/navigation-progress'
import { PageShell } from './components/site-chrome'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { envOf, viewerContext } from './context'
import { currentSession, readCookie } from './lib/auth.server'
import { isTheme, THEME_COOKIE, themeClass } from './lib/theme'

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
]

/** Reads the session and the whole account once; everything later in the request reuses it. */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    context.set(viewerContext, await currentSession(request, envOf(context)))
    return next()
  },
]

/**
 * Who is signed in, for the header on every page, and the theme picked in this browser. Text answers
 * from the Worker never get here.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext)
  const theme = readCookie(request, THEME_COOKIE)
  return {
    theme: isTheme(theme) ? theme : 'system',
    viewer: viewer
      ? {
          name: viewer.row.name,
          githubId: viewer.row.github_id,
          githubLogin: viewer.row.github_login,
        }
      : null,
  }
}

/** The viewer only changes when someone signs in or out, or picks or changes their name. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formAction }) =>
  Boolean(formAction && /^\/(auth|welcome|settings)/.test(formAction))

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useRouteLoaderData<typeof loader>('root')?.theme ?? 'system'
  return (
    <html lang="en" className={themeClass(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      {/* The page never scrolls; PageShell's main does, under the header. */}
      <body className="h-dvh overflow-hidden">
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 -translate-y-24 rounded-md bg-foreground px-3 py-2 text-background text-sm focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        {/* Here rather than in App, so error pages get tooltips too. */}
        <TooltipProvider delayDuration={400}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  const detail =
    status === 404
      ? 'There is no page at this address.'
      : 'Something failed on our side. Reload the page to try again.'
  return (
    <PageShell className="py-24">
      <h1 className="font-mono text-faint text-sm">{status}</h1>
      <p className="mt-2 text-2xl">{detail}</p>
      {import.meta.env.DEV && error instanceof Error ? (
        <pre className="mt-8 overflow-x-auto text-faint text-xs">{error.stack}</pre>
      ) : null}
    </PageShell>
  )
}
