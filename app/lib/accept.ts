/**
 * The same address serves people and machines. Only a request that explicitly ranks `text/html`
 * at least as high as `text/plain` gets the web page; curl, wget, sshd helpers and anything that
 * sends no Accept header get the key list.
 */
export function prefersHtml(accept: string | null): boolean {
  if (!accept) return false
  let html = 0
  let plain = 0
  for (const part of accept.split(',')) {
    const [range = '', ...params] = part.trim().toLowerCase().split(';')
    let quality = 1
    for (const param of params) {
      const [key, value] = param.trim().split('=')
      if (key === 'q') quality = Number.isFinite(Number(value)) ? Number(value) : 0
    }
    if (range.trim() === 'text/html') html = Math.max(html, quality)
    if (range.trim() === 'text/plain') plain = Math.max(plain, quality)
  }
  return html > 0 && html >= plain
}
