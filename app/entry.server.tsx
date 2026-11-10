import { isbot } from 'isbot'
import { renderToReadableStream } from 'react-dom/server'
import type { EntryContext } from 'react-router'
import { ServerRouter } from 'react-router'

export default async function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  routerContext: EntryContext,
) {
  let shellRendered = false
  let responseStatus = status
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatus = 500
        if (shellRendered) console.error(error)
      },
    },
  )
  shellRendered = true

  if (isbot(request.headers.get('user-agent') ?? '')) await body.allReady

  headers.set('content-type', 'text/html; charset=utf-8')
  return new Response(body, { headers, status: responseStatus })
}
