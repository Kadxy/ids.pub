/**
 * Just enough highlighting for the code the site shows people to run: shell commands, heredocs
 * and sshd config. Public keys are data, not code, and stay plain. Each returns the text cut into tokens;
 * joined, they are the input exactly.
 */
export type TokenKind =
  | 'program'
  | 'flag'
  | 'string'
  | 'operator'
  | 'comment'
  | 'keyword'
  | 'value'
  | 'placeholder'
  | 'plain'

export interface Token {
  text: string
  kind: TokenKind
}

const PROGRAM_PREFIXES = new Set(['sudo'])
/** Between commands: pipes, lists, and the parentheses of a subshell. */
const SEPARATORS = new Set(['|', '||', '&&', ';', '(', ')'])
/** Whitespace, a quoted string, or a run of anything else. */
const PIECE = /\s+|'[^']*'?|"(?:[^"\\]|\\.)*"?|[^\s'"]+/g

/** A command line: programs, flags, strings, URLs, redirections, pipes and a trailing comment. */
export function shellTokens(line: string): Token[] {
  const [code, comment] = splitComment(line)
  const tokens: Token[] = []
  let expectProgram = true
  // A word is pieces with no space between them, such as `'%{http_code}'` or `2>/dev/null`.
  let wordStart = true
  for (const [piece] of code.matchAll(PIECE)) {
    if (/^\s/.test(piece)) {
      tokens.push({ text: piece, kind: 'plain' })
      wordStart = true
      continue
    }
    const first = wordStart
    wordStart = false
    if (piece.startsWith("'") || piece.startsWith('"')) {
      tokens.push({ text: piece, kind: 'string' })
      if (first) expectProgram = false
      continue
    }
    // `(crontab` and `-)`: a subshell's parentheses are separators of their own.
    const [, open = '', body = '', close = ''] = /^(\(?)(.*?)(\)?)$/.exec(piece) ?? []
    if (open) {
      tokens.push({ text: open, kind: 'operator' })
      expectProgram = true
    }
    // `2>/dev/null`: the redirection is an operator, where it points is not.
    const redirect = first ? /^(\d?(?:>>|>|<<-?|<))(.*)$/.exec(body) : null
    if (redirect) {
      tokens.push({ text: redirect[1] ?? '', kind: 'operator' })
      if (redirect[2]) tokens.push({ text: redirect[2], kind: 'plain' })
    } else if (body) {
      const kind = wordKind(body, first, expectProgram)
      tokens.push({ text: body, kind })
      if (kind === 'operator') expectProgram = true
      else if (first) expectProgram = kind === 'program' && PROGRAM_PREFIXES.has(body)
    }
    if (close) tokens.push({ text: close, kind: 'operator' })
  }
  if (comment) tokens.push({ text: comment, kind: 'comment' })
  return tokens
}

/** A line cut where a `#` starts a word outside quotes: the code, then the comment. */
function splitComment(line: string): [string, string] {
  let wordStart = true
  for (const match of line.matchAll(PIECE)) {
    if (wordStart && match[0].startsWith('#')) {
      return [line.slice(0, match.index), line.slice(match.index)]
    }
    wordStart = /^\s/.test(match[0])
  }
  return [line, '']
}

function wordKind(word: string, first: boolean, expectProgram: boolean): TokenKind {
  if (SEPARATORS.has(word)) return 'operator'
  if (!first) return 'plain'
  if (expectProgram) return 'program'
  if (word.startsWith('-')) return 'flag'
  if (/^https?:\/\//.test(word)) return 'string'
  return 'plain'
}

/** What a heredoc carries: sshd config, or a script whose comments are all that's coloured. */
export type HeredocBody = 'sshd' | 'script'

/**
 * Commands as they are pasted, one line of tokens each: shell, except inside a heredoc (`<<'EOF'`
 * to `EOF`), whose lines are highlighted as what they carry.
 */
export function codeLines(commands: string, body: HeredocBody = 'script'): Token[][] {
  let delimiter: string | null = null
  return commands.split('\n').map((line) => {
    if (delimiter !== null) {
      if (line === delimiter) {
        delimiter = null
        return [{ text: line, kind: 'operator' }]
      }
      return body === 'sshd' ? sshdTokens(line) : scriptTokens(line)
    }
    delimiter = /<<-?\s*'?([A-Za-z_]+)'?\s*$/.exec(line)?.[1] ?? null
    return shellTokens(line)
  })
}

function scriptTokens(line: string): Token[] {
  const [code, comment] = splitComment(line)
  const tokens: Token[] = code ? [{ text: code, kind: 'plain' }] : []
  if (comment) tokens.push({ text: comment, kind: 'comment' })
  return tokens
}

/** sshd_config: comments, directives, and their values; a command's value as a command. */
export function sshdTokens(text: string): Token[] {
  const tokens: Token[] = []
  text.split('\n').forEach((line, index) => {
    if (index > 0) tokens.push({ text: '\n', kind: 'plain' })
    const [, indent = '', directive = '', gap = '', rest = ''] =
      /^(\s*)(\S*)(\s*)(.*)$/.exec(line) ?? []
    if (indent) tokens.push({ text: indent, kind: 'plain' })
    if (directive.startsWith('#')) {
      tokens.push({ text: directive + gap + rest, kind: 'comment' })
      return
    }
    if (directive) tokens.push({ text: directive, kind: 'keyword' })
    if (gap) tokens.push({ text: gap, kind: 'plain' })
    if (!rest) return
    if (directive === 'AuthorizedKeysCommand') tokens.push(...shellTokens(rest))
    else tokens.push({ text: rest, kind: 'value' })
  })
  return tokens
}

/**
 * Marks the words a person replaces before running the commands, such as a file name, wherever
 * they appear in a line's tokens. The text is unchanged.
 */
export function markPlaceholders(tokens: Token[], words: readonly string[]): Token[] {
  if (words.length === 0) return tokens
  const pattern = new RegExp(
    `(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  )
  return tokens.flatMap((token) =>
    token.text
      .split(pattern)
      .filter((part) => part !== '')
      .map((part) =>
        words.includes(part)
          ? { text: part, kind: 'placeholder' as const }
          : { ...token, text: part },
      ),
  )
}
