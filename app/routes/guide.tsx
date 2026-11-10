import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CodeBlock } from '~/components/code-block'
import { ExternalLink } from '~/components/external-link'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { signedInAccount } from '~/lib/console.server'
import { keyTitle } from '~/lib/directory'
import { factsFor } from '~/lib/key-facts'
import { cachedLoader } from '~/lib/page-cache'
import {
  AGE_KEY_TYPES,
  onceCommand,
  SYNC_SCHEDULES,
  sshdCheck,
  sshdCommands,
  sshdUndo,
  syncCommands,
  syncUndo,
  target,
} from '~/lib/server-setup'
import { curlCommand, publicUrl, SITE_HOST, signerPrincipal, signersUrl } from '~/lib/site'
import { cn } from '~/lib/utils'
import type { Route } from './+types/guide'

export const meta: Route.MetaFunction = () => [{ title: 'Guide – ids.pub' }]

export async function loader({ context }: Route.LoaderArgs) {
  const account = await signedInAccount(context)
  const keys = await Promise.all(
    account.keys.map(async (key) => {
      const facts = await factsFor(key.type, key.base64)
      return {
        id: key.id,
        type: key.type,
        base64: key.base64,
        title: keyTitle(key, facts.algorithm),
        algorithm: facts.algorithm,
        keysets: key.keysets,
      }
    }),
  )
  return {
    name: account.name,
    groups: account.keysets.map((keyset) => keyset.slug),
    private: account.private,
    keys,
  }
}

/** Back on this page, show it as it was and refresh it quietly; see ~/lib/page-cache. */
export const clientLoader = (args: Route.ClientLoaderArgs) => cachedLoader(args)

type GuideKey = Route.ComponentProps['loaderData']['keys'][number]

/**
 * The official pages each claim on this page comes from, linked from the word it is about.
 * - authorized_keys: sshd(8). One key per line; sshd reads the file of the account logged in to.
 * - AuthorizedKeysCommand: sshd_config(5). See ~/lib/server-setup for the details relied on.
 * - Allowed signers: ssh-keygen(1), ALLOWED SIGNERS. Git reads the file named by
 *   gpg.ssh.allowedSignersFile, and user.signingKey may be `key::` and a public key, whose
 *   private half ssh-agent holds: git-config(1).
 * - `ssh-keygen -lf -` fingerprints keys read from standard input: ssh-keygen(1), since 7.2.
 * - age and SSH keys: age's README.
 */
const DOCS = {
  authorizedKeys: 'https://man.openbsd.org/sshd.8#AUTHORIZED_KEYS_FILE_FORMAT',
  keysCommand: 'https://man.openbsd.org/sshd_config.5#AuthorizedKeysCommand',
  allowedSigners: 'https://man.openbsd.org/ssh-keygen.1#ALLOWED_SIGNERS',
  gitSigning: 'https://git-scm.com/docs/git-config#Documentation/git-config.txt-usersigningKey',
  fingerprint: 'https://man.openbsd.org/ssh-keygen.1#l',
  age: 'https://github.com/FiloSottile/age#ssh-keys',
}

const ALL = '*'

const TABS = [
  { value: 'server', label: 'Servers' },
  { value: 'git', label: 'Git' },
  { value: 'fingerprints', label: 'Fingerprints' },
  { value: 'age', label: 'Encryption' },
]

/** What an address is good for, one tab each, with the commands to paste for these keys. */
export default function Guide({ loaderData }: Route.ComponentProps) {
  const { name, groups } = loaderData
  const [searchParams] = useSearchParams()
  const asked = searchParams.get('group')
  const [group, setGroup] = useState(asked && groups.includes(asked) ? asked : ALL)
  const slug = group === ALL ? undefined : group
  const keys = slug ? loaderData.keys.filter((key) => key.keysets.includes(slug)) : loaderData.keys
  const at = { name, slug, keys }

  return (
    <>
      <PageHeader
        title="Guide"
        actions={
          groups.length > 0 ? (
            <KeysPicker
              value={group}
              onChange={setGroup}
              options={[
                { value: ALL, label: 'All keys' },
                ...groups.map((entry) => ({ value: entry, label: entry })),
              ]}
            />
          ) : null
        }
      />

      {loaderData.private ? (
        <Notice>
          Your profile is private, so your addresses return no keys.{' '}
          <Link to="/settings" className="text-link">
            Settings
          </Link>
        </Notice>
      ) : keys.length === 0 ? (
        <Notice>
          {slug ? 'This group has no keys yet.' : 'You have no keys yet.'}{' '}
          <Link to="/keys" className="text-link">
            Keys
          </Link>
        </Notice>
      ) : null}

      <Tabs defaultValue="server" className="gap-8">
        <TabsList variant="line" className="h-10 w-full justify-start gap-6 border-b pb-px">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-none px-0 text-[15px]">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="server">
          <Servers {...at} />
        </TabsContent>
        <TabsContent value="git">
          <Signatures {...at} />
        </TabsContent>
        <TabsContent value="fingerprints">
          <Fingerprints {...at} />
        </TabsContent>
        <TabsContent value="age">
          <Encryption {...at} />
        </TabsContent>
      </Tabs>
    </>
  )
}

interface At {
  name: string
  slug?: string
  keys: GuideKey[]
}

/**
 * Which keys the commands are for: all of them, or a group's. The one chosen is marked by its
 * weight and background, not a tick.
 */
function KeysPicker({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const chosen = options.find((option) => option.value === value) ?? options[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label="Keys" className="max-w-60 justify-between gap-2">
          <span className="truncate">{chosen?.label}</span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44 max-w-72">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="pr-2 data-[state=checked]:bg-accent data-[state=checked]:font-medium [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
            >
              <span className="truncate">{option.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Adding the keys once is what most people want. Keeping them in sync is a different thing, done
 * by sshd with sudo, or by cron without.
 */
function Servers({ name, slug }: At) {
  const url = publicUrl(name, slug)
  const to = target(name, slug)
  const [cron, setCron] = useState<string>(SYNC_SCHEDULES[0].cron)
  const schedule = SYNC_SCHEDULES.find((entry) => entry.cron === cron) ?? SYNC_SCHEDULES[0]
  return (
    <Stack>
      <Lead>Run this on the server:</Lead>
      <CodeBlock code={onceCommand(url)} />
      <Note>
        It adds them to <Doc href={DOCS.authorizedKeys}>~/.ssh/authorized_keys</Doc> for the user
        who runs it, once. Keys you add or delete here later don’t reach the server.
      </Note>

      <Heading>Keep in sync</Heading>
      <Lead>Or have the server follow every change you make here.</Lead>
      <Tabs defaultValue="sshd" className="gap-4">
        <TabsList>
          <TabsTrigger value="sshd" className="px-3">
            With sshd
          </TabsTrigger>
          <TabsTrigger value="cron" className="px-3">
            With cron
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sshd">
          <Stack>
            <CodeBlock code={sshdCommands(url)} body="sshd" />
            <Note>
              Needs sudo. sshd <Doc href={DOCS.keysCommand}>fetches the keys at every login</Doc>,
              so a key you delete stops working at once. While <Pub>{SITE_HOST}</Pub> is down, they
              can’t log in.
            </Note>
            <div className="grid justify-items-start">
              <Disclosure title="Check that sshd uses it">
                <CodeBlock code={sshdCheck()} />
                <Note>
                  The output should include the AuthorizedKeysCommand line above. If it shows{' '}
                  <Code>none</Code>, this server’s sshd_config does not include sshd_config.d, which
                  Debian and Ubuntu add but OpenSSH does not. Add the four lines from{' '}
                  <Code>Match User</Code> to <Code>Match all</Code> to the end of{' '}
                  <Code>/etc/ssh/sshd_config</Code>, then reload sshd.
                </Note>
              </Disclosure>
              <Disclosure title="Undo">
                <CodeBlock code={sshdUndo()} />
              </Disclosure>
            </div>
          </Stack>
        </TabsContent>

        <TabsContent value="cron">
          <Stack>
            <Field label="How often" htmlFor="sync-schedule">
              <Select value={cron} onValueChange={setCron}>
                <SelectTrigger id="sync-schedule" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {SYNC_SCHEDULES.map((entry) => (
                    <SelectItem key={entry.cron} value={entry.cron}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <CodeBlock code={syncCommands(to, cron)} />
            <Note>
              No sudo needed. cron updates the keys {schedule.label.toLowerCase()}, and leaves the
              rest of ~/.ssh/authorized_keys alone.
            </Note>
            <div className="grid justify-items-start">
              <Disclosure title="Undo">
                <CodeBlock code={syncUndo(to)} />
              </Disclosure>
            </div>
          </Stack>
        </TabsContent>
      </Tabs>
    </Stack>
  )
}

function Signatures({ name, slug, keys }: At) {
  const [signingId, setSigningId] = useState(keys[0]?.id)
  const signing = keys.find((key) => key.id === signingId) ?? keys[0]
  const principal = signerPrincipal(name)
  return (
    <Stack>
      <Heading first>Check signatures</Heading>
      <Lead>
        Add these keys to your <Doc href={DOCS.allowedSigners}>allowed signers</Doc>, and Git
        accepts commits signed with them, as <Pub>{principal}</Pub>.
      </Lead>
      <CodeBlock
        code={[
          `curl -fsS ${signersUrl(name, slug)} >> ~/.ssh/allowed_signers`,
          'git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers',
        ].join('\n')}
      />

      {signing ? (
        <>
          <Heading>Sign your commits</Heading>
          <Lead>On your computer, so others can check your commits the same way.</Lead>
          <Field label="Key" htmlFor="signing-key">
            <Select value={signing.id} onValueChange={setSigningId}>
              <SelectTrigger id="signing-key" size="sm" className="max-w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {keys.map((key) => (
                  <SelectItem key={key.id} value={key.id}>
                    {key.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <CodeBlock
            code={[
              'git config --global gpg.format ssh',
              `git config --global user.signingkey 'key::${signing.type} ${signing.base64}'`,
              'git config --global commit.gpgsign true',
            ].join('\n')}
          />
          <Note>
            Git <Doc href={DOCS.gitSigning}>signs through ssh-agent</Doc>, so this key has to be
            loaded there (ssh-add).
          </Note>
        </>
      ) : null}
    </Stack>
  )
}

function Fingerprints({ name, slug }: At) {
  return (
    <Stack>
      <Lead>
        Prints each key’s SHA256 fingerprint. Compare it with{' '}
        <Doc href={DOCS.fingerprint}>ssh-keygen -lf</Doc> on the machine that holds the key.
      </Lead>
      <CodeBlock code={`${curlCommand(name, slug)} | ssh-keygen -lf -`} />
    </Stack>
  )
}

/** The file in the commands, and the private key that opens it: both to be replaced. */
const FILE = 'report.pdf'
const IDENTITY = '~/.ssh/id_ed25519'

/**
 * age encrypts one file to every recipient it is given, so any one of their private keys opens
 * it. It skips SSH keys it can't use (see AGE_KEY_TYPES) and fails if none are left.
 */
function Encryption({ name, slug, keys }: At) {
  const usable = keys.filter((key) => AGE_KEY_TYPES.includes(key.type))
  const left = keys.filter((key) => !AGE_KEY_TYPES.includes(key.type))
  if (keys.length > 0 && usable.length === 0) {
    return (
      <Lead>
        <Doc href={DOCS.age}>age</Doc> only encrypts to Ed25519 and RSA keys, and none of these are.
      </Lead>
    )
  }
  return (
    <Stack>
      <Lead>
        Anyone can send you a file only you can open, with <Doc href={DOCS.age}>age</Doc>:
      </Lead>
      <CodeBlock
        code={`${curlCommand(name, slug)} | age -R - -o ${FILE}.age ${FILE}`}
        placeholders={[FILE]}
      />
      <Note>
        Replace <Code>{FILE}</Code> with the file. It is encrypted to every key here
        {left.length > 0
          ? ` except ${left.map((key) => key.title).join(' and ')}, which age can’t use`
          : ''}
        .
      </Note>

      <Heading>Open it</Heading>
      <Lead>With the private key of any one of them:</Lead>
      <CodeBlock
        code={`age -d -i ${IDENTITY} -o ${FILE} ${FILE}.age`}
        placeholders={[IDENTITY, FILE]}
      />
    </Stack>
  )
}

function Stack({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4">{children}</div>
}

/** A part of a tab. Only parts after the first need the space above them. */
function Heading({ first = false, children }: { first?: boolean; children: ReactNode }) {
  return (
    <h2 className={cn('font-semibold text-[17px] tracking-[-0.01em]', first ? undefined : 'mt-8')}>
      {children}
    </h2>
  )
}

/** What to do, in the page's reading size. */
function Lead({ children }: { children: ReactNode }) {
  return <p className="text-pretty text-[15px] leading-relaxed">{children}</p>
}

/** What happens, and its limits: a step quieter than the instructions. */
function Note({ children }: { children: ReactNode }) {
  return <p className="text-pretty text-muted-foreground text-sm leading-relaxed">{children}</p>
}

/** A small control with its label beside it. */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Label htmlFor={htmlFor} className="font-normal text-[13px] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

/** A word on the page, linked to the official page that says how it works, in a new tab. */
function Doc({ href, children }: { href: string; children: ReactNode }) {
  return (
    <ExternalLink href={href} className="text-link">
      {children}
    </ExternalLink>
  )
}

/** A value from the commands, named in a sentence. */
function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.92em] text-foreground">{children}</code>
}

/** What most people never need, folded away behind a button that says what it holds. */
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group -ml-2.5 gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronRightIcon className="transition-transform group-data-[state=open]:rotate-90" />
          {title}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid grid-cols-1 gap-3 pt-1 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

/** ids.pub, and names on it, set apart a little from the words around them. */
function Pub({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[0.92em] text-foreground">{children}</span>
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mb-6 rounded-lg bg-muted px-3 py-2 text-sm">{children}</p>
}
