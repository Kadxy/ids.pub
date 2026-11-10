/**
 * The "drunken bishop" picture `ssh-keygen -lv` draws for a key, ported from OpenSSH's
 * `fingerprint_randomart()` in sshkey.c. The output is byte-for-byte what ssh-keygen prints, so
 * people can compare the picture here with the one on their own machine.
 */

const WIDTH = 17
const HEIGHT = 9
const SYMBOLS = ' .o+=*BOX@%&#/^SE'
const MAX_VISITS = SYMBOLS.length - 1

export function randomart(digest: Uint8Array, label: string, bits: number, algorithm = 'SHA256') {
  const field = Array.from({ length: WIDTH }, () => new Array<number>(HEIGHT).fill(0))
  let x = Math.floor(WIDTH / 2)
  let y = Math.floor(HEIGHT / 2)

  for (const byte of digest) {
    let input = byte
    for (let step = 0; step < 4; step++) {
      x = clamp(x + (input & 0x1 ? 1 : -1), 0, WIDTH - 1)
      y = clamp(y + (input & 0x2 ? 1 : -1), 0, HEIGHT - 1)
      const column = field[x] as number[]
      if ((column[y] ?? 0) < MAX_VISITS - 2) column[y] = (column[y] ?? 0) + 1
      input >>= 2
    }
  }

  ;(field[Math.floor(WIDTH / 2)] as number[])[Math.floor(HEIGHT / 2)] = MAX_VISITS - 1
  ;(field[x] as number[])[y] = MAX_VISITS

  const rows: string[] = [border(fitTitle(label, bits))]
  for (let row = 0; row < HEIGHT; row++) {
    let line = '|'
    for (let column = 0; column < WIDTH; column++) {
      line += SYMBOLS[Math.min(field[column]?.[row] ?? 0, MAX_VISITS)]
    }
    rows.push(`${line}|`)
  }
  rows.push(border(`[${algorithm}]`))
  return rows.join('\n')
}

/**
 * OpenSSH formats the title into a 17-byte buffer: it falls back to `[label]` only when the full
 * title is longer than the buffer, and either way keeps at most 16 characters.
 */
function fitTitle(label: string, bits: number): string {
  const full = `[${label} ${bits}]`
  return (full.length > WIDTH ? `[${label}]` : full).slice(0, WIDTH - 1)
}

function border(title: string): string {
  const left = Math.floor((WIDTH - title.length) / 2)
  return `+${'-'.repeat(left)}${title}${'-'.repeat(WIDTH - left - title.length)}+`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
