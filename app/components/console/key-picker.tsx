import { useState } from 'react'
import { Link } from 'react-router'
import { FILTER_THRESHOLD, FilterInput } from '~/components/console/bits'
import { FieldBlock } from '~/components/console/field-block'
import { keyTitle } from '~/lib/directory'
import { KeyCheckRow, ResourceTable, ResourceTableEmpty } from './resource-list'
import type { ConsoleKey } from './types'

/**
 * Every key on the account, each with a checkbox: in the group, or not. A filter appears once there
 * are enough keys; Select all and Select none act on the keys shown and sit on the label's line, or
 * on a line of their own without a label.
 */
export function KeyPicker({
  keys,
  value,
  onChange,
  label,
}: {
  keys: ConsoleKey[]
  value: string[]
  onChange: (keyIds: string[]) => void
  label?: string
}) {
  const [filter, setFilter] = useState('')
  const query = filter.trim().toLowerCase()
  const shown = query
    ? keys.filter(
        (key) =>
          keyTitle(key, key.facts.algorithm).toLowerCase().includes(query) ||
          key.comment.toLowerCase().includes(query) ||
          key.facts.algorithm.toLowerCase().includes(query),
      )
    : keys
  const allShown = shown.length > 0 && shown.every((key) => value.includes(key.id))

  const wrap = (aside: React.ReactNode, children: React.ReactNode) =>
    label ? (
      <FieldBlock label={label} aside={aside}>
        {children}
      </FieldBlock>
    ) : (
      <div className="grid min-w-0 gap-1.5">
        {aside ? <div className="flex justify-end">{aside}</div> : null}
        {children}
      </div>
    )

  if (keys.length === 0) {
    return wrap(
      null,
      <p className="text-muted-foreground text-sm">
        No keys yet.{' '}
        <Link to="/keys" className="text-link">
          Add one
        </Link>
      </p>,
    )
  }

  const selectAll =
    shown.length > 1 ? (
      <button
        type="button"
        className="text-muted-foreground text-xs hover:text-foreground"
        onClick={() => {
          const shownIds = shown.map((key) => key.id)
          onChange(
            allShown
              ? value.filter((keyId) => !shownIds.includes(keyId))
              : [...value, ...shownIds.filter((keyId) => !value.includes(keyId))],
          )
        }}
      >
        {allShown ? 'Select none' : 'Select all'}
      </button>
    ) : null

  return wrap(
    selectAll,
    <>
      {keys.length >= FILTER_THRESHOLD ? (
        <FilterInput value={filter} onChange={setFilter} placeholder="Filter keys" />
      ) : null}
      <ResourceTable head={['Name', 'Added']}>
        {shown.map((key) => (
          <KeyCheckRow
            key={key.id}
            entry={key}
            checked={value.includes(key.id)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, key.id] : value.filter((keyId) => keyId !== key.id))
            }
          />
        ))}
        {shown.length === 0 ? (
          <ResourceTableEmpty>No keys match “{filter}”.</ResourceTableEmpty>
        ) : null}
      </ResourceTable>
    </>,
  )
}
