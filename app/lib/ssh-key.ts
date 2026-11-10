/**
 * Parsing and canonicalising OpenSSH public key lines.
 *
 * Only the bare `type base64 [comment]` form is accepted. Anything that would change how sshd
 * treats the line (options such as `command=`, certificates, multiple keys) is rejected, so the
 * text we serve can never carry more than a key.
 */

export const KEY_TYPES = [
  'ssh-ed25519',
  'sk-ssh-ed25519@openssh.com',
  'ecdsa-sha2-nistp256',
  'ecdsa-sha2-nistp384',
  'ecdsa-sha2-nistp521',
  'sk-ecdsa-sha2-nistp256@openssh.com',
  'ssh-rsa',
] as const

export type KeyType = (typeof KEY_TYPES)[number]

export const RSA_MIN_BITS = 2048
const RSA_MAX_BITS = 16384
/** sshd(8): a line of authorized_keys can be up to 8 kilobytes. */
export const LINE_MAX_BYTES = 8192

export interface PublicKey {
  type: KeyType
  /** The decoded wire-format blob, validated against `type`. */
  blob: Uint8Array
  /** Canonical base64 of `blob`. */
  base64: string
  bits: number
  /** The name OpenSSH prints for this kind of key: ED25519, ED25519-SK, ECDSA, ECDSA-SK, RSA. */
  label: string
  /** The rest of the pasted line after the key, cleaned of control characters. May be empty. */
  comment: string
}

export type ParseError =
  | 'empty'
  | 'private-key'
  | 'rfc4716'
  | 'multiple-keys'
  | 'has-options'
  | 'certificate'
  | 'dsa'
  | 'unknown-type'
  | 'bad-encoding'
  | 'type-mismatch'
  | 'malformed'
  | 'rsa-too-small'
  | 'too-long'

export type ParseResult = { ok: true; key: PublicKey } | { ok: false; error: ParseError }

const isKeyType = (value: string): value is KeyType =>
  (KEY_TYPES as readonly string[]).includes(value)

export function parsePublicKey(input: string): ParseResult {
  const text = input.trim()
  if (text === '') return fail('empty')
  if (/PRIVATE KEY-----|PuTTY-User-Key-File/.test(text)) return fail('private-key')
  if (text.startsWith('---- BEGIN SSH2 PUBLIC KEY')) return fail('rfc4716')

  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length > 1) return fail('multiple-keys')

  const line = (lines[0] ?? '').trim()
  const tokens = line.split(/\s+/)
  const typeIndex = tokens.findIndex(
    (token) => isKeyType(token) || token === 'ssh-dss' || token.endsWith('-cert-v01@openssh.com'),
  )
  if (typeIndex === -1) return fail('unknown-type')
  if (typeIndex > 0) return fail('has-options')

  const type = tokens[0] ?? ''
  if (type === 'ssh-dss') return fail('dsa')
  if (!isKeyType(type)) return fail('certificate')

  const blob = decodeBase64(tokens[1] ?? '')
  if (!blob) return fail('bad-encoding')

  const shape = readShape(type, blob)
  if (!shape.ok) return shape

  // As sshd reads it, the comment is everything after the key, to the end of the line.
  const comment = cleanComment(line.replace(/^\S+\s+\S+/, ''))
  const base64 = encodeBase64(blob)
  if (!lineFits({ type, base64 }, comment)) return fail('too-long')

  return {
    ok: true,
    key: { type, blob, base64, bits: shape.bits, label: labelFor(type), comment },
  }
}

/** One line of authorized_keys: the key and its comment, never any options. */
export function authorizedKeysLine(
  key: Pick<PublicKey, 'type' | 'base64'>,
  comment: string,
): string {
  const cleaned = cleanComment(comment)
  return cleaned ? `${key.type} ${key.base64} ${cleaned}` : `${key.type} ${key.base64}`
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

/** The fingerprint `ssh-keygen -l` prints by default, e.g. `SHA256:BcmU…w3M`. */
export function formatFingerprint(digest: Uint8Array): string {
  return `SHA256:${encodeBase64(digest).replace(/=+$/, '')}`
}

/**
 * A comment as sshd(8) has it: free text that runs to the end of the line. Control characters,
 * which could start a new line or mangle a terminal reading the keys, become spaces; the ends are
 * trimmed. Nothing else changes.
 */
export function cleanComment(raw: string): string {
  return raw.replace(/\p{Cc}/gu, ' ').trim()
}

/** Whether the key's line, comment included, is within the 8 kilobytes sshd reads. */
export function lineFits(key: Pick<PublicKey, 'type' | 'base64'>, comment: string): boolean {
  return new TextEncoder().encode(authorizedKeysLine(key, comment)).length <= LINE_MAX_BYTES
}

function fail(error: ParseError): ParseResult {
  return { ok: false, error }
}

/**
 * The algorithm as people write it: Ed25519 as in RFC 8032, curves by their NIST names, RSA with
 * its size. `-SK` marks a key held on a security key. (ssh-keygen's capitalised labels, used for
 * its picture, are `label`.)
 */
export function algorithmName(type: KeyType, bits: number): string {
  switch (type) {
    case 'ssh-ed25519':
      return 'Ed25519'
    case 'sk-ssh-ed25519@openssh.com':
      return 'Ed25519-SK'
    case 'sk-ecdsa-sha2-nistp256@openssh.com':
      return 'ECDSA-SK P-256'
    case 'ssh-rsa':
      return `RSA ${bits}`
    default:
      return `ECDSA P-${bits}`
  }
}

function labelFor(type: KeyType): string {
  switch (type) {
    case 'ssh-ed25519':
      return 'ED25519'
    case 'sk-ssh-ed25519@openssh.com':
      return 'ED25519-SK'
    case 'sk-ecdsa-sha2-nistp256@openssh.com':
      return 'ECDSA-SK'
    case 'ssh-rsa':
      return 'RSA'
    default:
      return 'ECDSA'
  }
}

const ECDSA_POINT_LENGTH: Record<string, number> = { nistp256: 65, nistp384: 97, nistp521: 133 }

type Shape = { ok: true; bits: number } | { ok: false; error: ParseError }

function readShape(type: KeyType, blob: Uint8Array): Shape {
  const reader = new WireReader(blob)
  try {
    if (reader.string() !== type) return { ok: false, error: 'type-mismatch' }

    let bits: number
    switch (type) {
      case 'ssh-ed25519':
      case 'sk-ssh-ed25519@openssh.com': {
        if (reader.bytes().length !== 32) return { ok: false, error: 'malformed' }
        bits = 256
        break
      }
      case 'ssh-rsa': {
        const exponent = reader.bytes()
        if (exponent.length === 0) return { ok: false, error: 'malformed' }
        bits = mpintBits(reader.bytes())
        if (bits > RSA_MAX_BITS) return { ok: false, error: 'malformed' }
        if (bits < RSA_MIN_BITS) return { ok: false, error: 'rsa-too-small' }
        break
      }
      default: {
        const curve = reader.string()
        const expectedCurve = type.match(/nistp\d+/)?.[0]
        const point = reader.bytes()
        if (
          curve !== expectedCurve ||
          point.length !== ECDSA_POINT_LENGTH[curve] ||
          point[0] !== 4
        ) {
          return { ok: false, error: 'malformed' }
        }
        bits = Number(curve.slice('nistp'.length))
      }
    }

    if (type.startsWith('sk-') && reader.string() === '') return { ok: false, error: 'malformed' }
    if (!reader.done) return { ok: false, error: 'malformed' }
    return { ok: true, bits }
  } catch {
    return { ok: false, error: 'malformed' }
  }
}

function mpintBits(bytes: Uint8Array): number {
  let start = 0
  while (start < bytes.length && bytes[start] === 0) start++
  if (start === bytes.length) return 0
  return (bytes.length - start - 1) * 8 + (32 - Math.clz32(bytes[start] ?? 0))
}

class WireReader {
  #offset = 0
  readonly #view: DataView
  readonly #bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  get done(): boolean {
    return this.#offset === this.#bytes.length
  }

  bytes(): Uint8Array {
    if (this.#offset + 4 > this.#bytes.length) throw new RangeError('truncated length')
    const length = this.#view.getUint32(this.#offset)
    this.#offset += 4
    if (this.#offset + length > this.#bytes.length) throw new RangeError('truncated value')
    const value = this.#bytes.subarray(this.#offset, this.#offset + length)
    this.#offset += length
    return value
  }

  string(): string {
    return new TextDecoder('utf-8', { fatal: true }).decode(this.bytes())
  }
}

function decodeBase64(text: string): Uint8Array | null {
  if (text.length === 0 || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    return null
  }
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
