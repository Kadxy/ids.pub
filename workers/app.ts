import { createRequestHandler, RouterContextProvider } from 'react-router'
import { cloudflareContext } from '~/context'
import { d1Directory } from '~/lib/db.server'
import { matchPublicPath, refuseInsecure, respondWithKeys } from '~/lib/public-endpoint'

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
)

export default {
  async fetch(request, env, ctx) {
    // Nothing is served under /.well-known yet. Answer here, so probes such as Chrome DevTools'
    // workspace lookup don't reach the router and get logged as errors.
    if (new URL(request.url).pathname.startsWith('/.well-known/')) {
      return new Response(null, { status: 404 })
    }

    const insecure = refuseInsecure(request, env.APP_ORIGIN)
    if (insecure) return insecure

    const keys = await respondWithKeys(request, d1Directory(env.DB))
    if (keys) return keys

    const context = new RouterContextProvider()
    context.set(cloudflareContext, { env, ctx })
    const page = await requestHandler(request, context)

    // The page and the key list share a URL, so caches must key on Accept.
    const path = matchPublicPath(new URL(request.url).pathname)
    if (path && path.format === undefined && path.keyset === undefined) {
      const headers = new Headers(page.headers)
      headers.append('vary', 'Accept')
      return new Response(page.body, { status: page.status, statusText: page.statusText, headers })
    }
    return page
  },
} satisfies ExportedHandler<Env>
