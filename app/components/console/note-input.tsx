import type { ChangeEvent } from 'react'
import { GrowingTextarea } from '~/components/growing-textarea'
import { LIMITS } from '~/lib/directory'

/** A note: private, a sentence or two on one line, wrapping as it grows. Enter saves. */
export function NoteInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <GrowingTextarea
      id={id}
      name="note"
      value={value}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      singleLine
      maxLength={LIMITS.note}
      autoComplete="off"
    />
  )
}
