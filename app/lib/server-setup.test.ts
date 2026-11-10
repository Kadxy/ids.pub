import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncCommands, syncUndo } from './server-setup'

/**
 * Runs what the Guide asks people to paste, in a throwaway home, against a stand-in for ids.pub:
 * curl is wrapped to send https://ids.pub/ here, and crontab keeps its table in a file.
 */
const answers = new Map<string, { status: number; body: string }>()
const server = Bun.serve({
  port: 0,
  fetch(request) {
    const answer = answers.get(new URL(request.url).pathname) ?? { status: 404, body: '' }
    return new Response(answer.status === 200 ? answer.body : '', { status: answer.status })
  },
})
const root = mkdtempSync(join(tmpdir(), 'ids-sync-'))
const bin = join(root, 'bin')
const home = join(root, 'home')

function tool(name: string, script: string) {
  writeFileSync(join(bin, name), script)
  chmodSync(join(bin, name), 0o755)
}

/** Async, so the stand-in server in this process can answer while the shell runs. */
async function paste(commands: string): Promise<number> {
  const run = Bun.spawn(['sh'], {
    stdin: new TextEncoder().encode(commands),
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, USER: 'someone' },
  })
  return run.exited
}

const authorizedKeys = () => readFileSync(join(home, '.ssh/authorized_keys'), 'utf8')
const crontab = () => readFileSync(join(home, 'crontab'), 'utf8')
const serve = (path: string, body: string, status = 200) => answers.set(path, { status, body })

const LAPTOP = 'ssh-ed25519 AAAAlaptop laptop'
const CI = 'ssh-ed25519 AAAAci deploy'
const MINE = 'ssh-ed25519 AAAAmine added by hand'

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(bin, { recursive: true })
  mkdirSync(join(home, '.ssh'), { recursive: true })
  writeFileSync(join(home, '.ssh/authorized_keys'), `${MINE}\n`)
  tool(
    'curl',
    `#!/bin/sh\nfor a; do shift; case $a in https://ids.pub/*) a="http://localhost:${server.port}/\${a#https://ids.pub/}";; esac; set -- "$@" "$a"; done\nexec /usr/bin/curl "$@"\n`,
  )
  tool(
    'crontab',
    `#!/bin/sh\nf="$HOME/crontab"\ncase $1 in\n  -l) cat "$f" 2>/dev/null || { echo "no crontab for $USER" >&2; exit 1; } ;;\n  -) t=$(mktemp); cat >"$t"; mv "$t" "$f" ;;\nesac\n`,
  )
  answers.clear()
  serve('/alice', `${LAPTOP}\n${CI}\n`)
  serve('/alice/ci', `${CI}\n`)
})

afterAll(() => {
  server.stop(true)
  rmSync(root, { recursive: true, force: true })
})

describe('keeping keys in sync without sudo', () => {
  test('adds a marked block, keeps every other line, and runs every minute', async () => {
    expect(await paste(syncCommands('alice'))).toBe(0)
    expect(authorizedKeys()).toBe(
      `${MINE}\n# begin ids.pub/alice\n${LAPTOP}\n${CI}\n# end ids.pub/alice\n`,
    )
    expect(crontab()).toBe('* * * * * $HOME/.ssh/ids-pub-sync alice\n')
    expect(statSync(join(home, '.ssh/authorized_keys')).mode & 0o777).toBe(0o600)
  })

  test('pasting again, or for a group, adds no second copy', async () => {
    await paste(syncCommands('alice'))
    await paste(syncCommands('alice/ci'))
    await paste(syncCommands('alice'))
    expect(crontab()).toBe(
      '* * * * * $HOME/.ssh/ids-pub-sync alice/ci\n* * * * * $HOME/.ssh/ids-pub-sync alice\n',
    )
    expect(authorizedKeys().match(/# begin ids\.pub\/alice$/gm)).toHaveLength(1)
    expect(authorizedKeys().match(/# begin ids\.pub\/alice\/ci$/gm)).toHaveLength(1)
  })

  test('another schedule replaces the cron line', async () => {
    await paste(syncCommands('alice'))
    expect(await paste(syncCommands('alice', '*/10 * * * *'))).toBe(0)
    expect(crontab()).toBe('*/10 * * * * $HOME/.ssh/ids-pub-sync alice\n')
  })

  test('a deleted key leaves at the next run, as cron runs it', async () => {
    await paste(syncCommands('alice'))
    serve('/alice', `${CI}\n`)
    const line = crontab().trim().split(' ').slice(5).join(' ')
    expect(await paste(line)).toBe(0)
    expect(authorizedKeys()).toBe(`${MINE}\n# begin ids.pub/alice\n${CI}\n# end ids.pub/alice\n`)
  })

  test.each([
    ['ids.pub is failing', 503],
    ['ids.pub is out of reach', 0],
  ])('keeps the last keys while %s', async (_, status) => {
    await paste(syncCommands('alice'))
    const before = authorizedKeys()
    if (status) serve('/alice', '', status)
    else tool('curl', '#!/bin/sh\nexit 7\n')
    expect(await paste('~/.ssh/ids-pub-sync alice')).toBe(0)
    expect(authorizedKeys()).toBe(before)
  })

  test('a name that is gone, or made private, empties its block', async () => {
    await paste(syncCommands('alice'))
    serve('/alice', '', 410)
    await paste('~/.ssh/ids-pub-sync alice')
    expect(authorizedKeys()).toBe(`${MINE}\n# begin ids.pub/alice\n# end ids.pub/alice\n`)
  })

  test('undo removes the cron line and the block, and nothing else', async () => {
    await paste(syncCommands('alice'))
    await paste(syncCommands('alice/ci'))
    expect(await paste(syncUndo('alice'))).toBe(0)
    expect(crontab()).toBe('* * * * * $HOME/.ssh/ids-pub-sync alice/ci\n')
    expect(authorizedKeys()).toBe(
      `${MINE}\n# begin ids.pub/alice/ci\n${CI}\n# end ids.pub/alice/ci\n`,
    )
  })
})
