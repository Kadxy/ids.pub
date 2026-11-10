import { describe, expect, test } from 'bun:test'
import { codeLines, markPlaceholders, shellTokens, sshdTokens } from './highlight'

const join = (tokens: { text: string }[]) => tokens.map((token) => token.text).join('')
const kinds = (tokens: { text: string; kind: string }[]) =>
  tokens.filter((token) => token.kind !== 'plain').map((token) => `${token.kind}:${token.text}`)

describe('highlight', () => {
  test('a piped command: programs, flags, URLs, the pipe', () => {
    const line = 'curl -fsSL https://ids.pub/sh/sync.sh | sudo sh -s -- alice/ci'
    expect(join(shellTokens(line))).toBe(line)
    expect(kinds(shellTokens(line))).toEqual([
      'program:curl',
      'flag:-fsSL',
      'string:https://ids.pub/sh/sync.sh',
      'operator:|',
      'program:sudo',
      'program:sh',
      'flag:-s',
      'flag:--',
    ])
  })

  test('sshd config keeps every character, and reads the command as a command', () => {
    const config = '# a comment\nMatch User you\n    AuthorizedKeysCommand /usr/bin/curl -fsS x'
    expect(join(sshdTokens(config))).toBe(config)
    expect(kinds(sshdTokens(config))).toEqual([
      'comment:# a comment',
      'keyword:Match',
      'value:User you',
      'keyword:AuthorizedKeysCommand',
      'program:/usr/bin/curl',
      'flag:-fsS',
    ])
  })

  test('quotes, redirections, a subshell and a trailing comment', () => {
    const line =
      "(crontab -l 2>/dev/null | grep -v 'a b$'; echo '* * x') | crontab - # keep the rest"
    expect(join(shellTokens(line))).toBe(line)
    expect(kinds(shellTokens(line))).toEqual([
      'operator:(',
      'program:crontab',
      'flag:-l',
      'operator:2>',
      'operator:|',
      'program:grep',
      'flag:-v',
      "string:'a b$'",
      'operator:;',
      'program:echo',
      "string:'* * x'",
      'operator:)',
      'operator:|',
      'program:crontab',
      'flag:-',
      'comment:# keep the rest',
    ])
  })

  test('a heredoc is read as what it carries, up to its delimiter', () => {
    const commands = 'sudo tee f <<EOF\nMatch User $USER\nEOF\nsudo sshd -t'
    const lines = codeLines(commands, 'sshd')
    expect(lines.map(join)).toEqual(commands.split('\n'))
    expect(kinds(lines[1] ?? [])).toEqual(['keyword:Match', 'value:User $USER'])
    expect(kinds(lines[3] ?? [])).toEqual(['program:sudo', 'program:sshd', 'flag:-t'])
  })

  test("a script in a heredoc colours only its comments, and # inside quotes isn't one", () => {
    const lines = codeLines('cat > f <<\'EOF\'\nbegin="# x" # why\nEOF')
    expect(kinds(lines[1] ?? [])).toEqual(['comment:# why'])
  })

  test('placeholders are marked where they appear, and the text is unchanged', () => {
    const line = 'age -R - -o report.pdf.age report.pdf'
    const tokens = markPlaceholders(shellTokens(line), ['report.pdf'])
    expect(join(tokens)).toBe(line)
    expect(tokens.filter((token) => token.kind === 'placeholder')).toHaveLength(2)
  })
})
