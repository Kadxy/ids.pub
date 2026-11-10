/**
 * What the Guide asks people to paste on a server. Nothing is downloaded and run: every line that
 * will run is on the page, the script included, so it can be read before it is pasted.
 *
 * Where each piece comes from:
 * - ~/.ssh/authorized_keys, one key per line, `#` lines ignored, read by sshd for the account it
 *   is in: sshd(8), AUTHORIZED_KEYS FILE FORMAT. It and ~/.ssh must not be writable by others, or
 *   sshd ignores them (StrictModes): hence the script's umask 077. The commands assume ~/.ssh
 *   exists, as it does for anyone who has logged in with a key or run ssh-keygen.
 * - AuthorizedKeysCommand and AuthorizedKeysCommandUser, Match, and the rule that the first value
 *   wins (so sshd_config.d, included at the top, overrides sshd_config): sshd_config(5). The
 *   command runs after AuthorizedKeysFile and only when no key there matched, so keys already in
 *   authorized_keys keep working while ids.pub can't be reached.
 * - The Include of sshd_config.d is Debian's and Ubuntu's, not upstream OpenSSH's: Debian's
 *   sshd_config(5).
 * - `sshd -T -C user=…` prints the settings for that user, needing only what Match uses: sshd(8),
 *   OpenSSH 7.7 and 8.1 release notes.
 */

/**
 * Keeps an address's keys in ~/.ssh/authorized_keys without sudo: cron runs it every minute.
 * Only a failed request leaves the file alone; a name that is gone or private empties its block.
 */
export const SYNC_SCRIPT = `#!/bin/sh
# ids-pub-sync NAME[/GROUP] [remove]
# Keeps the keys at https://ids.pub/NAME[/GROUP] between two marker lines in
# ~/.ssh/authorized_keys. Lines outside the markers are left alone.
set -eu
file="$HOME/.ssh/authorized_keys"
begin="# begin ids.pub/$1"
end="# end ids.pub/$1"
umask 077
keys=$(mktemp "$HOME/.ssh/.ids-pub.XXXXXX")
next=$(mktemp "$HOME/.ssh/.ids-pub.XXXXXX")
trap 'rm -f "$keys" "$next"' EXIT
if [ "\${2-}" != remove ]; then
  status=$(curl -sS --max-time 20 -o "$keys" -w '%{http_code}' "https://ids.pub/$1") || exit 0
  case $status in
    200) ;;
    404 | 410) : >"$keys" ;; # The name is gone or private: no keys.
    *) exit 0 ;;             # ids.pub is having trouble: keep what's there.
  esac
fi
touch "$file"
awk -v b="$begin" -v e="$end" '$0 == b { skip = 1 } !skip { print } $0 == e { skip = 0 }' "$file" >"$next"
[ "\${2-}" = remove ] || { echo "$begin"; cat "$keys"; echo "$end"; } >>"$next"
cmp -s "$next" "$file" || mv "$next" "$file"`

/** `alice` or `alice/ci`: what the script and its cron line are given. */
export const target = (name: string, keyset?: string) => (keyset ? `${name}/${keyset}` : name)

const cronMatch = (to: string) => `'ids-pub-sync ${to}$'`

/** How often cron runs the script: how long a deleted key can still log in. */
export const SYNC_SCHEDULES = [
  { cron: '* * * * *', label: 'Every minute' },
  { cron: '*/5 * * * *', label: 'Every 5 minutes' },
  { cron: '*/10 * * * *', label: 'Every 10 minutes' },
  { cron: '*/30 * * * *', label: 'Every 30 minutes' },
  { cron: '0 * * * *', label: 'Every hour' },
] as const

/** Pasting it again, with another schedule, replaces the cron line rather than adding one. */
export function syncCommands(to: string, cron = '* * * * *'): string {
  return [
    "cat > ~/.ssh/ids-pub-sync <<'EOF'",
    SYNC_SCRIPT,
    'EOF',
    'chmod 700 ~/.ssh/ids-pub-sync',
    `~/.ssh/ids-pub-sync ${to}`,
    `(crontab -l 2>/dev/null | grep -v ${cronMatch(to)}; echo '${cron} $HOME/.ssh/ids-pub-sync ${to}') | crontab -`,
  ].join('\n')
}

export function syncUndo(to: string): string {
  return [
    `crontab -l | grep -v ${cronMatch(to)} | crontab -`,
    `~/.ssh/ids-pub-sync ${to} remove`,
  ].join('\n')
}

/**
 * sshd_config(5): one Match block per server account, in sshd_config.d. The heredoc isn't quoted,
 * so the shell fills in $USER: the account that pastes it is the one the keys open.
 */
const SSHD_FILE = '/etc/ssh/sshd_config.d/50-ids-pub-$USER.conf'
/** Reload only a config that passes `sshd -t`. Debian and Ubuntu call the service ssh. */
const SSHD_RELOAD =
  'sudo sshd -t && (sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd)'

export function sshdCommands(url: string): string {
  return [
    `sudo tee ${SSHD_FILE} > /dev/null <<EOF`,
    'Match User $USER',
    `    AuthorizedKeysCommand /usr/bin/curl -fsS --max-time 5 ${url}`,
    '    AuthorizedKeysCommandUser nobody',
    'Match all',
    'EOF',
    SSHD_RELOAD,
  ].join('\n')
}

/** sshd(8) -T prints the settings sshd would use, here for the account that runs it. */
export const sshdCheck = () => 'sudo sshd -T -C user=$USER | grep -i authorizedkeyscommand'

export function sshdUndo(): string {
  return [`sudo rm ${SSHD_FILE}`, SSHD_RELOAD].join('\n')
}

export const onceCommand = (url: string) => `curl -fsS ${url} >> ~/.ssh/authorized_keys`

/**
 * age encrypts to these two kinds of SSH key (age's README, "SSH keys"). It skips the others with
 * a warning, and fails with "no recipients found" when none are left (cmd/age/parse.go).
 */
export const AGE_KEY_TYPES: readonly string[] = ['ssh-ed25519', 'ssh-rsa']
