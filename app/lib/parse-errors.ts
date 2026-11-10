import type { ParseError } from './ssh-key'

/** What to tell someone whose paste isn't a public key we accept, and how to fix it. */
export const PARSE_ERROR_MESSAGES: Record<ParseError, string> = {
  empty: 'Paste a public key.',
  'private-key':
    'That was a private key, so it was cleared. It never left this page. Paste the matching .pub file instead.',
  rfc4716:
    'This key is in SSH2 format. Convert it with ssh-keygen -i -f key.pub, then paste the result.',
  'multiple-keys': 'Paste one key at a time.',
  'has-options':
    'Remove the options in front of the key type. ids.pub stores the key and nothing else.',
  certificate: "Certificates aren't supported. Paste the plain public key instead.",
  dsa: 'OpenSSH no longer accepts DSA keys. Create a new one with ssh-keygen -t ed25519.',
  'unknown-type':
    "This doesn't look like an SSH public key. It should start with ssh-ed25519, ecdsa-sha2- or ssh-rsa.",
  'bad-encoding': 'The key is damaged or cut short. Copy the whole line again.',
  malformed: 'The key is damaged or cut short. Copy the whole line again.',
  'type-mismatch': "The key's type doesn't match its contents. Copy the whole line again.",
  'rsa-too-small': 'RSA keys need at least 2048 bits. Create a new key with ssh-keygen -t ed25519.',
  'too-long': 'The line is longer than the 8 KB that OpenSSH reads. Shorten the comment.',
}
