import { createContext, type ReactNode, useContext, useId } from 'react'
import { Link } from 'react-router'
import { KeyAvatar } from '~/components/key-avatar'
import { Checkbox } from '~/components/ui/checkbox'
import { keyPath, keyTitle } from '~/lib/directory'
import { formatDate } from '~/lib/key-facts'
import { cn } from '~/lib/utils'
import type { ConsoleKey } from './types'

/**
 * Wide, on the keys and groups pages: the name, a short middle column (a key's type, a group's
 * keys) at the same place on both pages, and the date; phones leave out the date. Compact, on a
 * key's or a group's own page: the name and the date, in lower rows.
 */
const LAYOUT = {
  wide: {
    columns: 'grid grid-cols-[minmax(0,1fr)_8rem] gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_7rem]',
    row: 'h-13',
    head: 'py-2.5',
  },
  compact: {
    columns: 'grid grid-cols-[minmax(0,1fr)_7rem] gap-4',
    row: 'h-11',
    head: 'py-2',
  },
}
type Layout = keyof typeof LAYOUT
const LayoutContext = createContext<Layout>('wide')

/**
 * The one table for keys and groups, wherever they are listed. The columns line up whatever the
 * lengths; text that doesn't fit ends in an ellipsis and shows in full on hover.
 */
export function ResourceTable({
  head,
  children,
}: {
  /** The column titles: the name, the middle column and the date, or just the name and the date. */
  head: [string, string, string] | [string, string]
  children: ReactNode
}) {
  const layout: Layout = head.length === 3 ? 'wide' : 'compact'
  const { columns, head: headPadding } = LAYOUT[layout]
  const date = head[head.length - 1]
  return (
    <LayoutContext.Provider value={layout}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div
          aria-hidden="true"
          className={cn(columns, headPadding, 'border-b bg-muted/40 px-4 text-[13px] text-faint')}
        >
          <span>{head[0]}</span>
          {layout === 'wide' ? <span>{head[1]}</span> : null}
          <span className={cn('text-right', layout === 'wide' && 'max-sm:hidden')}>{date}</span>
        </div>
        <ul className="divide-y">{children}</ul>
      </div>
    </LayoutContext.Provider>
  )
}

function useRowClass() {
  const layout = useContext(LayoutContext)
  return {
    layout,
    className: cn(LAYOUT[layout].columns, LAYOUT[layout].row, 'items-center px-4 text-[15px]'),
  }
}

function Title({ media, title, muted }: { media?: ReactNode; title: string; muted?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {media}
      <span title={title} className={cn('truncate font-medium', muted && 'text-muted-foreground')}>
        {title}
      </span>
    </span>
  )
}

function DateCell({ date }: { date: string }) {
  const layout = useContext(LayoutContext)
  return (
    <span
      className={cn(
        'text-right text-muted-foreground tabular-nums',
        layout === 'wide' && 'max-sm:hidden',
      )}
    >
      {date}
    </span>
  )
}

/** One row, a link to the key or group. */
export function ResourceTableRow({
  to,
  media,
  title,
  muted,
  middle,
  date,
}: {
  to: string
  media?: ReactNode
  title: string
  /** Show the title in grey, as for a key with nothing to call it by. */
  muted?: boolean
  /** What goes in the middle column. Only wide tables have one. */
  middle?: ReactNode
  date: string
}) {
  const { layout, className } = useRowClass()
  return (
    <li>
      <Link
        to={to}
        prefetch="intent"
        className={cn(
          className,
          'outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50',
        )}
      >
        <Title media={media} title={title} muted={muted} />
        {layout === 'compact' ? null : <span className="flex min-w-0">{middle}</span>}
        <DateCell date={date} />
      </Link>
    </li>
  )
}

/** A row with a checkbox in front, for choosing which rows belong: the keys in a group. */
export function ResourceTableCheckRow({
  checked,
  onCheckedChange,
  media,
  title,
  muted,
  date,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  media?: ReactNode
  title: string
  muted?: boolean
  date: string
}) {
  const id = useId()
  const { className } = useRowClass()
  return (
    <li>
      <label
        htmlFor={id}
        className={cn(className, 'cursor-pointer transition-colors hover:bg-muted/50')}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Checkbox
            id={id}
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
          />
          <Title media={media} title={title} muted={muted} />
        </span>
        <DateCell date={date} />
      </label>
    </li>
  )
}

/** A key as a row: on the keys page, and on the page of each group it is in. */
export function KeyRow({ entry: key }: { entry: ConsoleKey }) {
  return (
    <ResourceTableRow
      to={keyPath(key.id)}
      media={<KeyAvatar icon={key.icon} size="sm" />}
      title={keyTitle(key, key.facts.algorithm)}
      muted={!key.name.trim() && !key.comment.trim()}
      middle={<span className="truncate text-muted-foreground">{key.facts.algorithm}</span>}
      date={formatDate(key.addedAt)}
    />
  )
}

/** A key with a checkbox, for picking the keys in a group. */
export function KeyCheckRow({
  entry: key,
  checked,
  onCheckedChange,
}: {
  entry: ConsoleKey
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <ResourceTableCheckRow
      checked={checked}
      onCheckedChange={onCheckedChange}
      media={<KeyAvatar icon={key.icon} size="sm" />}
      title={keyTitle(key, key.facts.algorithm)}
      muted={!key.name.trim() && !key.comment.trim()}
      date={formatDate(key.addedAt)}
    />
  )
}

type StackKey = Pick<ConsoleKey, 'id' | 'icon'> & { title: string }

/** A group as a row: on the groups page, with its keys, and on the page of each key in it. */
export function GroupRow({
  group,
}: {
  group: { slug: string; createdAt: string; keys?: StackKey[] }
}) {
  return (
    <ResourceTableRow
      to={`/groups/${group.slug}`}
      title={group.slug}
      middle={group.keys ? <KeyStack keys={group.keys} /> : null}
      date={formatDate(group.createdAt)}
    />
  )
}

const STACK_MAX = 5

/**
 * A group's keys as their icons, overlapping a little like the members of a chat; past five, the
 * last place says how many more. Each icon is named on hover.
 */
function KeyStack({ keys }: { keys: StackKey[] }) {
  if (keys.length === 0) return <span className="text-faint">—</span>
  const shown = keys.length > STACK_MAX ? keys.slice(0, STACK_MAX - 1) : keys
  const rest = keys.length - shown.length
  return (
    <span className="flex items-center -space-x-1">
      {shown.map((key) => (
        <span key={key.id} title={key.title} className="rounded-[7px] ring-2 ring-card">
          <KeyAvatar icon={key.icon} size="sm" />
        </span>
      ))}
      {rest > 0 ? (
        <span
          title={keys
            .slice(shown.length)
            .map((key) => key.title)
            .join('\n')}
          className="inline-grid size-6 place-items-center rounded-md bg-secondary font-medium text-[11px] text-muted-foreground tabular-nums ring-2 ring-card"
        >
          +{rest}
        </span>
      ) : null}
      <span className="sr-only">{keys.map((key) => key.title).join(', ')}</span>
    </span>
  )
}

/** In place of rows, when a filter matches nothing. */
export function ResourceTableEmpty({ children }: { children: ReactNode }) {
  return <li className="px-4 py-8 text-center text-muted-foreground text-sm">{children}</li>
}
