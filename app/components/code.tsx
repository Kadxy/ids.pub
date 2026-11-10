import type { Token, TokenKind } from '~/lib/highlight'

const COLORS: Record<TokenKind, string> = {
  program: 'text-code-entity',
  flag: 'text-code-constant',
  string: 'text-code-string',
  operator: 'text-code-keyword',
  comment: 'text-code-comment',
  keyword: 'text-code-keyword',
  value: 'text-code-constant',
  // What to replace: in the text's own colour, underlined with dots, so it reads as a blank.
  placeholder: 'text-foreground underline decoration-dotted decoration-faint underline-offset-4',
  plain: '',
}

/** Highlighted code, from tokens made by ~/lib/highlight. */
export function Code({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((token, index) =>
        token.kind === 'plain' ? (
          token.text
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: tokens never reorder
          <span key={index} className={COLORS[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </>
  )
}
