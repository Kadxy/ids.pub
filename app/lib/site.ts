export const SITE_ORIGIN = 'https://ids.pub'
export const SITE_HOST = 'ids.pub'

export function addressPath(name: string, keyset?: string): string {
  return keyset ? `/${name}/${keyset}` : `/${name}`
}

/** `ids.pub/alice/ci`: how an address is shown to people. */
export function displayAddress(name: string, keyset?: string): string {
  return `${SITE_HOST}${addressPath(name, keyset)}`
}

/** `https://ids.pub/alice/ci`: what goes into commands. Never without the scheme, or curl uses http. */
export function publicUrl(name: string, keyset?: string): string {
  return `${SITE_ORIGIN}${addressPath(name, keyset)}`
}

/** `https://ids.pub/alice/ci.signers`: the keys as an allowed signers file. */
export function signersUrl(name: string, keyset?: string): string {
  return `${publicUrl(name, keyset)}.signers`
}

/** Who signed, in an allowed signers file: `alice@ids.pub`, the same for every group. */
export function signerPrincipal(name: string): string {
  return `${name}@${SITE_HOST}`
}

export function curlCommand(name: string, keyset?: string): string {
  return `curl -fsS ${publicUrl(name, keyset)}`
}

/** Where the code lives. ids.pub is open source: anyone can read it, or run their own. */
export const REPO_URL = 'https://github.com/kadxy/ids.pub'
