import type { Account, Directory, Lookup } from '~/lib/directory'

/**
 * A fixed directory for endpoint tests. Every key is a real public key generated with ssh-keygen,
 * so fingerprints match what ssh-keygen prints.
 */

const mira: Account = {
  id: 'mira',
  name: 'mira',
  renames: [],
  names: [
    { name: 'mira-old', status: 'active', since: '2026-03-14T09:12:00Z' },
    { name: 'mira', status: 'current', since: '2026-06-02T18:40:00Z' },
  ],
  github: { id: 1001, login: 'mira-example', twoFactor: false },
  keysets: [
    { slug: 'admin', createdAt: '2026-03-14T09:20:00Z', note: '' },
    { slug: 'ci', createdAt: '2026-08-09T11:02:00Z', note: '' },
    { slug: 'work', createdAt: '2026-05-20T08:31:00Z', note: '' },
  ],
  keys: [
    {
      id: 'laptop',
      type: 'ssh-ed25519',
      base64: 'AAAAC3NzaC1lZDI1NTE5AAAAIJ6RNhWCGts+o9e+sMtLB6jRwd3yLF2c4d+tDN+1HbQl',
      name: 'laptop',
      comment: 'laptop',
      note: '',
      addedAt: '2026-03-14T09:15:00Z',
      keysets: ['admin', 'work'],
      icon: 'key',
    },
    {
      id: 'yubikey',
      type: 'sk-ssh-ed25519@openssh.com',
      base64:
        'AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIMXAv0lAjWWQOQ+4E4f0a0MMPbAVxdhOuxP0UYLWTg76AAAABHNzaDo=',
      name: 'yubikey-5c',
      comment: 'yubikey-5c',
      note: '',
      addedAt: '2026-03-14T09:16:00Z',
      keysets: ['admin'],
      icon: 'key',
    },
    {
      id: 'thinkpad',
      type: 'ssh-rsa',
      base64:
        'AAAAB3NzaC1yc2EAAAADAQABAAABgQDJ0xxXE/JDvD75gR2CWjGVVMRs0uF7U9d7Q+5Paj/rwAEhqLn9vD9oaPkgVoqEqbLxVEA4ro5nZg9sX5vjN/5PHiRFbNblQ7BgpgrDhEwXb+D1dptm34l3fy+5xWxeT9iqUB3T9Ff8XylKuDD7rAkj7M0Ge+fw6gHjkqtOrEdLl4BO9VMymDNoXzLIs52r5n3Ft9cSr5vM6WB+nWqXKqCQVR1/7uznNEmstDV2nTWRWV73YMyiO9TJAC5ckg98q1nftpDbjk/mVch3n4GWC+ba24QZFEhyJUl1+vXlctRV/71JA2mJi/zLT66CLBSfs3aKUDgdoMvBZb6vcC8lMw3jfiq/hzzYmwzfAuSlK4Wm48nS5j4KF5J/xYg5fEzIxWWHpdxK5jdf+RWhjXWAJRgPhmTP+Yo+ckfQ7sdbzh3p5ek3mM+5V21W1zuOweYhMJVB8D2sLeTbo4uuLY1+5AixFjighFYidTShRfIpRsZywEwGstlLmgx+sTwA/lgBkJ8=',
      name: 'old-thinkpad',
      comment: 'old-thinkpad',
      note: '',
      addedAt: '2026-03-14T09:18:00Z',
      keysets: [],
      icon: 'key',
    },
    {
      id: 'workmac',
      type: 'ecdsa-sha2-nistp256',
      base64:
        'AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBIFWQ6WTLDtmZsqV3/pKwqlrWICDR7uMluAnhuQjh1yrX63I1P5dnLogVlLctis3nwQjiDK+P0TC1dBATrTHQmM=',
      name: 'work-mac',
      comment: 'work-mac',
      note: '',
      addedAt: '2026-05-20T08:30:00Z',
      keysets: ['work'],
      icon: 'key',
    },
    {
      id: 'deploy',
      type: 'ssh-ed25519',
      base64: 'AAAAC3NzaC1lZDI1NTE5AAAAIDQsJJpL9YIQAU3dQ3RvB55xFzAIWlgIinuqZ6HpfeH4',
      name: 'deploy-bot',
      comment: 'deploy-bot',
      note: '',
      addedAt: '2026-08-09T11:00:00Z',
      keysets: ['ci'],
      icon: 'key',
    },
  ],
  private: false,
  updatedAt: '2026-10-21T16:05:00Z',
}

const bob: Account = {
  id: 'bob',
  name: 'bob',
  renames: [],
  names: [{ name: 'bob', status: 'current', since: '2026-04-02T12:00:00Z' }],
  github: { id: 1002, login: 'bob-example', twoFactor: true },
  keysets: [],
  keys: [
    {
      id: 'bob_desktop',
      type: 'ssh-ed25519',
      base64: 'AAAAC3NzaC1lZDI1NTE5AAAAIN4MEPZv/iDoOdZC0Koh6E3yPDCcrU9I43flYhG0tLPx',
      name: 'desktop',
      comment: 'desktop',
      note: '',
      addedAt: '2026-04-02T12:03:00Z',
      keysets: [],
      icon: 'key',
    },
  ],
  private: false,
  updatedAt: '2026-04-02T12:03:00Z',
}

/** Alice's keys under an account kept private: its addresses serve nothing. */
const dana: Account = {
  ...mira,
  id: 'dana',
  name: 'dana',
  renames: [],
  names: [{ name: 'dana', status: 'current', since: '2026-07-01T00:00:00Z' }],
  private: true,
}

const ACCOUNTS: Account[] = [mira, bob, dana]

/** Names of deleted accounts. They stay taken forever and answer 410. */
const TOMBSTONES = new Set(['carol'])

export const fixtureDirectory: Directory = {
  async lookup(name: string): Promise<Lookup> {
    if (TOMBSTONES.has(name)) return { kind: 'gone', requested: name }
    for (const account of ACCOUNTS) {
      const held = account.names.find((entry) => entry.name === name)
      if (!held) continue
      if (held.status === 'retired') return { kind: 'gone', requested: name }
      return { kind: 'found', account, requested: name }
    }
    return { kind: 'missing', requested: name }
  },
}
