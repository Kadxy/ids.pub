import { randomart } from './randomart'
import { algorithmName, formatFingerprint, type PublicKey, parsePublicKey, sha256 } from './ssh-key'

/** What tells keys apart: the algorithm, and the ssh-keygen fingerprint and picture. */
export interface KeyFacts {
  /** How the interface names the algorithm, e.g. "Ed25519" or "RSA 4096". */
  algorithm: string
  label: string
  bits: number
  fingerprint: string
  art: string
}

export async function factsForKey(key: PublicKey): Promise<KeyFacts> {
  const digest = await sha256(key.blob)
  return {
    algorithm: algorithmName(key.type, key.bits),
    label: key.label,
    bits: key.bits,
    fingerprint: formatFingerprint(digest),
    art: randomart(digest, key.label, key.bits),
  }
}

export async function factsFor(type: string, base64: string): Promise<KeyFacts> {
  const parsed = parsePublicKey(`${type} ${base64}`)
  if (!parsed.ok) throw new Error(`stored key no longer parses: ${parsed.error}`)
  return factsForKey(parsed.key)
}

const DATE = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "Dec 18, 2025" */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso))
}

/** "a", "a and b", "a, b and c"; pass "or" for alternatives. */
export function listOf(items: string[], conjunction: 'and' | 'or' = 'and'): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`
}
