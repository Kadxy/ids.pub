import { describe, expect, test } from 'bun:test'
import { randomart } from './randomart'
import {
  algorithmName,
  authorizedKeysLine,
  formatFingerprint,
  parsePublicKey,
  sha256,
} from './ssh-key'

// Generated with ssh-keygen; expected values are what `ssh-keygen -lv -f <key>.pub` printed.
const FIXTURES = [
  {
    line: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ6RNhWCGts+o9e+sMtLB6jRwd3yLF2c4d+tDN+1HbQl alice@laptop',
    bits: 256,
    label: 'ED25519',
    fingerprint: 'SHA256:BcmUxAGwbtktaryU+iTNhSdTFDdXhbQkla0wHhwXw3M',
    art: `+--[ED25519 256]--+
|    ..+BB=+*O*.  |
|     o .=+=+=oE  |
|    . .  ..+.+   |
|   . = . .. .    |
|    B = S        |
|   = B .         |
|  . X            |
|   * .           |
|  ..o            |
+----[SHA256]-----+`,
  },
  {
    line: 'sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIMXAv0lAjWWQOQ+4E4f0a0MMPbAVxdhOuxP0UYLWTg76AAAABHNzaDo= alice@yubikey-5c',
    bits: 256,
    label: 'ED25519-SK',
    fingerprint: 'SHA256:yBHDjL4eJCatf1ystG3Y6a1m5uxLttLDjaW9C/dcIkk',
    art: `+[ED25519-SK 256]-+
|     +o          |
|    . oo         |
| . .  .          |
|. + o. o         |
| + o oo E        |
|.   + o...       |
| . + @+B+ . .    |
|  . O+#=o+ o     |
|   . XO++oo      |
+----[SHA256]-----+`,
  },
  {
    line: 'ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBIFWQ6WTLDtmZsqV3/pKwqlrWICDR7uMluAnhuQjh1yrX63I1P5dnLogVlLctis3nwQjiDK+P0TC1dBATrTHQmM= alice@work-mac',
    bits: 256,
    label: 'ECDSA',
    fingerprint: 'SHA256:LRD6YanL/fxL9DqKQyWag3DOEwz6ZIkIikQqcdaMNBM',
    art: `+---[ECDSA 256]---+
|ooE=  .          |
|+=.oo. o         |
|X+ .. =          |
|O B  +.o..       |
| O o.o.oS o      |
|  *.+o.  o .     |
|   .oo.   . .    |
|      .+ ...     |
|      ..+o+o     |
+----[SHA256]-----+`,
  },
  {
    line: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDJ0xxXE/JDvD75gR2CWjGVVMRs0uF7U9d7Q+5Paj/rwAEhqLn9vD9oaPkgVoqEqbLxVEA4ro5nZg9sX5vjN/5PHiRFbNblQ7BgpgrDhEwXb+D1dptm34l3fy+5xWxeT9iqUB3T9Ff8XylKuDD7rAkj7M0Ge+fw6gHjkqtOrEdLl4BO9VMymDNoXzLIs52r5n3Ft9cSr5vM6WB+nWqXKqCQVR1/7uznNEmstDV2nTWRWV73YMyiO9TJAC5ckg98q1nftpDbjk/mVch3n4GWC+ba24QZFEhyJUl1+vXlctRV/71JA2mJi/zLT66CLBSfs3aKUDgdoMvBZb6vcC8lMw3jfiq/hzzYmwzfAuSlK4Wm48nS5j4KF5J/xYg5fEzIxWWHpdxK5jdf+RWhjXWAJRgPhmTP+Yo+ckfQ7sdbzh3p5ek3mM+5V21W1zuOweYhMJVB8D2sLeTbo4uuLY1+5AixFjighFYidTShRfIpRsZywEwGstlLmgx+sTwA/lgBkJ8= old-thinkpad',
    bits: 3072,
    label: 'RSA',
    fingerprint: 'SHA256:pDjj4gEwr4LJGgcJl9tsFdvBGzx6qDfNR5avBhEeCkI',
    art: `+---[RSA 3072]----+
| .E   .o.        |
|  ...  +B.       |
|+ o. .o=o* .     |
|o= + o+o= +      |
|+ o B..+S+ .     |
|o= o.oo + . .    |
|*.+ .. . o .     |
|o+ o      o      |
|. .      .       |
+----[SHA256]-----+`,
  },
]

describe('algorithmName', () => {
  test('names algorithms the way people write them', () => {
    const names = FIXTURES.map((fixture) => {
      const result = parsePublicKey(fixture.line)
      if (!result.ok) throw new Error(result.error)
      return algorithmName(result.key.type, result.key.bits)
    })
    expect(names).toEqual(['Ed25519', 'Ed25519-SK', 'ECDSA P-256', 'RSA 3072'])
  })
})

describe('parsePublicKey', () => {
  for (const fixture of FIXTURES) {
    test(`matches ssh-keygen for ${fixture.label}`, async () => {
      const result = parsePublicKey(fixture.line)
      if (!result.ok) throw new Error(result.error)
      const { key } = result
      expect(key.bits).toBe(fixture.bits)
      expect(key.label).toBe(fixture.label)
      expect(`${key.type} ${key.base64} ${key.comment}`).toBe(fixture.line)

      const digest = await sha256(key.blob)
      expect(formatFingerprint(digest)).toBe(fixture.fingerprint)
      expect(randomart(digest, key.label, key.bits)).toBe(fixture.art)
    })
  }

  const ed25519 = FIXTURES[0]?.line ?? ''
  const [type, base64] = ed25519.split(' ')

  test.each([
    ['', 'empty'],
    [
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----',
      'private-key',
    ],
    ['---- BEGIN SSH2 PUBLIC KEY ----\nAAAA\n---- END SSH2 PUBLIC KEY ----', 'rfc4716'],
    [`${ed25519}\n${ed25519}`, 'multiple-keys'],
    [`command="/bin/sh" ${ed25519}`, 'has-options'],
    [`from="10.0.0.0/8",no-pty ${ed25519}`, 'has-options'],
    [`ssh-ed25519-cert-v01@openssh.com ${base64}`, 'certificate'],
    ['ssh-dss AAAAB3NzaC1kc3MAAACBAP', 'dsa'],
    ['hello world', 'unknown-type'],
    [`${type} not*base64`, 'bad-encoding'],
    [`${type} ${base64?.slice(0, -4)}`, 'malformed'],
    [`ecdsa-sha2-nistp256 ${base64}`, 'type-mismatch'],
  ])('rejects %p as %p', (input, error) => {
    expect(parsePublicKey(input)).toEqual({ ok: false, error } as never)
  })

  test('rejects RSA keys shorter than 2048 bits', () => {
    const blob = new Uint8Array([
      ...wireString('ssh-rsa'),
      ...wireBytes(new Uint8Array([1, 0, 1])),
      ...wireBytes(new Uint8Array([0x00, 0xc0, ...new Array(127).fill(0xab)])),
    ])
    expect(parsePublicKey(`ssh-rsa ${btoa(String.fromCharCode(...blob))}`)).toEqual({
      ok: false,
      error: 'rsa-too-small',
    })
  })

  test('keeps the comment as sshd reads it, to the end of the line, without control characters', () => {
    const result = parsePublicKey(`${type} ${base64}   alice\u0007  at\tlaptop  `)
    expect(result.ok && result.key.comment).toBe('alice   at laptop')
  })

  test('rejects a line longer than the 8 kilobytes sshd reads', () => {
    const fits = 8192 - `${type} ${base64} `.length
    expect(parsePublicKey(`${type} ${base64} ${'a'.repeat(fits)}`).ok).toBe(true)
    expect(parsePublicKey(`${type} ${base64} ${'a'.repeat(fits + 1)}`)).toEqual({
      ok: false,
      error: 'too-long',
    })
  })
})

describe('authorizedKeysLine', () => {
  test('never lets a name break onto a new line', () => {
    expect(
      authorizedKeysLine({ type: 'ssh-ed25519', base64: 'AAAA' }, 'a\nssh-rsa BBBB evil'),
    ).toBe('ssh-ed25519 AAAA a ssh-rsa BBBB evil')
  })

  test('omits the comment when the name is blank', () => {
    expect(authorizedKeysLine({ type: 'ssh-ed25519', base64: 'AAAA' }, ' \n ')).toBe(
      'ssh-ed25519 AAAA',
    )
  })
})

function wireBytes(bytes: Uint8Array): number[] {
  const length = bytes.length
  return [
    (length >>> 24) & 255,
    (length >>> 16) & 255,
    (length >>> 8) & 255,
    length & 255,
    ...bytes,
  ]
}

function wireString(text: string): number[] {
  return wireBytes(new TextEncoder().encode(text))
}
