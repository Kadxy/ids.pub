import { describe, expect, test } from 'bun:test'
import { prefersHtml } from './accept'
import { isClaimableName, isWellFormedName, normalizeName } from './names'

describe('names', () => {
  test.each(['alice', 'a', 'alice-dev', 'a1-b2-c3', 'x'.repeat(39)])('accepts %p', (name) => {
    expect(isWellFormedName(name)).toBe(true)
  })

  test.each(['', '-alice', 'alice-', 'al--ice', 'alice.keys', 'Alice', 'al_ice', 'x'.repeat(40)])(
    'rejects %p',
    (name) => {
      expect(isWellFormedName(name)).toBe(false)
    },
  )

  test.each(['settings', 'keys', 'keysets', 'map'])('%p is a page, not a name', (word) => {
    expect(isWellFormedName(word)).toBe(true)
    expect(isClaimableName(word)).toBe(false)
  })

  test('the example address on the home page belongs to no one', () => {
    expect(isClaimableName('example')).toBe(false)
    expect(isClaimableName('alice')).toBe(false)
  })

  test('names are case-insensitive', () => {
    expect(normalizeName(' Alice ')).toBe('alice')
  })
})

describe('prefersHtml', () => {
  test.each([
    ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', true],
    ['text/html', true],
    ['text/plain, text/html;q=0.5', false],
    ['*/*', false],
    ['text/plain', false],
    ['application/json', false],
    ['text/html;q=0', false],
    ['', false],
  ])('%p → %p', (accept, expected) => {
    expect(prefersHtml(accept)).toBe(expected)
  })

  test('treats a missing header as a machine', () => {
    expect(prefersHtml(null)).toBe(false)
  })
})
