import { describe, expect, test } from 'bun:test'
import { guessIcon, keyTitle } from './directory'

describe('guessIcon', () => {
  test('reads what the key is for from its comment', () => {
    expect(guessIcon({ comment: 'alice@MacBook-Pro', type: 'ssh-ed25519' })).toBe('laptop')
    expect(guessIcon({ comment: 'deploy@ci', type: 'ssh-ed25519' })).toBe('bot')
    expect(guessIcon({ comment: 'github-actions', type: 'ssh-ed25519' })).toBe('git')
    expect(guessIcon({ comment: 'alice', type: 'ssh-ed25519' })).toBe('key')
  })

  test('a hardware key is a security key whatever its comment', () => {
    expect(guessIcon({ comment: 'laptop', type: 'sk-ssh-ed25519@openssh.com' })).toBe(
      'security-key',
    )
  })
})

describe('keyTitle', () => {
  test('the name, else the comment, else the algorithm', () => {
    expect(keyTitle({ name: 'Work laptop', comment: 'alice@mbp' }, 'Ed25519')).toBe('Work laptop')
    expect(keyTitle({ name: ' ', comment: 'alice@mbp' }, 'Ed25519')).toBe('alice@mbp')
    expect(keyTitle({ name: '', comment: '' }, 'Ed25519')).toBe('Ed25519 key')
  })
})
