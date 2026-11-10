/**
 * Stale while revalidate, for the console's pages: going back to a page shows what it showed last
 * time at once, and fresh data replaces it a moment later, without a spinner. Anything that changes
 * data (any action) forgets every page first, so a page is never shown stale after a save.
 * Browser only: the cache lives in this tab's memory and starts empty on every full load.
 */

const pages = new Map<string, unknown>()
/** Pages just shown from the cache, waiting for their fresh data. */
const stale = new Set<string>()
/** Pages whose next load must come from the server: the refresh after a cached showing. */
const refreshing = new Set<string>()

/** A route's clientLoader: the cached page if there is one, else the server's. */
export async function cachedLoader<T>({
  request,
  serverLoader,
}: {
  request: Request
  serverLoader: () => Promise<T>
}): Promise<T> {
  const path = new URL(request.url).pathname
  if (pages.has(path) && !refreshing.has(path)) {
    stale.add(path)
    return pages.get(path) as T
  }
  refreshing.delete(path)
  const data = await serverLoader()
  pages.set(path, data)
  return data
}

/** A route's clientAction: forget every page, then do the action on the server. */
export async function forgettingAction<T>({
  serverAction,
}: {
  serverAction: () => Promise<T>
}): Promise<T> {
  pages.clear()
  stale.clear()
  return serverAction()
}

/** Keeps what a page showed, including on the first load, which came with the HTML. */
export function rememberPage(path: string, data: unknown) {
  if (data !== undefined) pages.set(path, data)
}

/** Whether the page was just shown from the cache; if so, its next load goes to the server. */
export function takeStale(path: string): boolean {
  if (!stale.delete(path)) return false
  refreshing.add(path)
  return true
}
