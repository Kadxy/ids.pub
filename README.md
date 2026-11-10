# ids.pub

A home for your public keys. Every key you use sits at one address, such as `https://ids.pub/alice`, and anything that reads `authorized_keys` lines can read it. Put keys in groups, and each group gets an address of its own with only those keys, such as `https://ids.pub/alice/prod`.

```console
$ curl -fsS https://ids.pub/alice
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ6RNhWCGts+o9e+sMtLB6jRwd3yLF2c4d+tDN+1HbQl laptop
sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29tAAAAIMXAv0lAjWWQOQ+4E4f0a0MMPbAVxdhOuxP0UYLWTg76AAAABHNzaDo= yubikey
```

## Using an address

Add the keys to a server once:

```sh
curl -fsS https://ids.pub/alice >> ~/.ssh/authorized_keys
```

Or have sshd look them up at every login, so a key removed on ids.pub stops working at once. In `/etc/ssh/sshd_config.d/`:

```
Match User deploy
    AuthorizedKeysCommand /usr/bin/curl -fsS --max-time 5 https://ids.pub/alice/prod
    AuthorizedKeysCommandUser nobody
Match all
```

Keys already in `~/.ssh/authorized_keys` keep working: sshd reads that file first, and runs the command only when no key there matches.

The same address works beyond logins:

```sh
# Check fingerprints
curl -fsS https://ids.pub/alice | ssh-keygen -lf -

# Trust someone's signed Git commits
curl -fsS https://ids.pub/alice.signers >> ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers

# Encrypt a file to someone with age
curl -fsS https://ids.pub/alice | age -R - -o notes.txt.age notes.txt
```

Signed in, the Guide at `/guide` gives these commands for your own keys and groups, including a cron script that keeps `authorized_keys` in sync without sudo.

## How addresses answer

| Request                      | Answer                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `/<name>`                    | Every key, one per line, as `<type> <base64> <comment>`. A browser asking for HTML gets the person's page instead.                         |
| `/<name>/<group>`            | Only the keys in that group, always as text.                                                                                               |
| `.keys`, `.json`, `.signers` | Text, JSON with fingerprints and dates, or an allowed signers file with `<name>@ids.pub` as the signer, whatever the `Accept` header says. |
| Unknown name or group        | `404` with an empty body. A name no longer in use answers `410`; a private account answers `404`.                                          |
| Plain HTTP                   | `400`. Keys are only served over HTTPS.                                                                                                    |

Responses are never cached, and keys are served exactly as stored, with no `authorized_keys` options such as `command=` or `from=`. Names are never reused.

## Running it

ids.pub is a [React Router](https://reactrouter.com) app on [Cloudflare Workers](https://developers.cloudflare.com/workers/), with its data in [D1](https://developers.cloudflare.com/d1/). People sign in with a GitHub OAuth app. It uses [Bun](https://bun.sh).

```sh
bun install
cp .dev.vars.example .dev.vars   # then fill in the GitHub OAuth app's id and secret
```

1. Create a D1 database (`bunx wrangler d1 create <name>`) and put its name and id in `wrangler.jsonc`, along with your own domain (in `routes` and `APP_ORIGIN`) and `GITHUB_CLIENT_ID`. The values there are ids.pub's own.
2. Create a GitHub OAuth app whose callback is `<APP_ORIGIN>/auth/github/callback` (for development, `http://localhost:3201/auth/github/callback`).
3. Apply the migrations: `bun run db:migrate`.
4. Set the client secret on the Worker: `bunx wrangler secret put GITHUB_CLIENT_SECRET`.

| Command             | Does                                                                     |
| ------------------- | ------------------------------------------------------------------------ |
| `bun dev`           | Runs the app at `http://localhost:3201`, against the remote D1 database. |
| `bun test`          | Runs the tests.                                                          |
| `bun run typecheck` | Generates route and Worker types, then checks them.                      |
| `bun run check`     | Lints and checks formatting with Biome.                                  |
| `bun run deploy`    | Builds and deploys the Worker.                                           |

## Layout

- `workers/app.ts`: the Worker. It answers key requests itself and hands everything else to React Router.
- `app/lib/public-endpoint.ts`: how addresses answer.
- `app/lib/ssh-key.ts`: parsing and checking OpenSSH public keys.
- `app/lib/server-setup.ts`: the commands the Guide gives, with tests that run them.
- `app/routes/`: the pages.
- `migrations/`: the D1 schema.

## License

[MIT](LICENSE)
