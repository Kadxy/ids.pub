import { useEffect, useId, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { toast } from 'sonner'
import { GrowingTextarea } from '~/components/growing-textarea'
import { InfoTip } from '~/components/info-tip'
import { KeyAvatar } from '~/components/key-avatar'
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '~/components/responsive-dialog'
import { Button } from '~/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { useFetcherResult } from '~/hooks/use-fetcher-result'
import { guessIcon, type KeyIcon, LIMITS } from '~/lib/directory'
import { factsForKey, type KeyFacts } from '~/lib/key-facts'
import { PARSE_ERROR_MESSAGES } from '~/lib/parse-errors'
import { cleanComment, type ParseError, type PublicKey, parsePublicKey } from '~/lib/ssh-key'
import { cn } from '~/lib/utils'
import { NoteInput } from './note-input'
import type { ActionResult, ConsoleKey } from './types'

interface AddKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keys: ConsoleKey[]
}

/** A panel from the right on desktop and a drawer on phones: paste a key or import its .pub file. */
export function AddKeyDialog({ open, onOpenChange, keys }: AddKeyDialogProps) {
  const fetcher = useFetcher<ActionResult>()

  useFetcherResult(fetcher, (result) => {
    if (!result.ok || result.intent !== 'add') return
    onOpenChange(false)
    toast(`Added ${result.name}`)
  })

  const serverError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="New SSH key" sheet>
      <KeyForm
        keys={keys}
        fetcher={fetcher}
        serverError={serverError}
        onCancel={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  )
}

interface FormProps {
  keys: ConsoleKey[]
  fetcher: ReturnType<typeof useFetcher<ActionResult>>
  serverError: string | null
  onCancel: () => void
}

type Preview =
  | { ok: true; key: PublicKey; facts: KeyFacts; icon: KeyIcon; duplicateOf: boolean }
  | { ok: false; error: ParseError }

/** What a public key line looks like, short enough for one line on a phone. */
const PLACEHOLDER = 'ssh-ed25519 AAAAC3Nza… you@laptop'

/** A .pub file is one line. Anything much bigger is not a public key. */
const MAX_FILE_BYTES = 16 * 1024

function KeyForm({ keys, fetcher, serverError, onCancel }: FormProps) {
  const ids = { text: useId(), name: useId(), comment: useId(), note: useId() }
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [note, setNote] = useState('')

  // Re-parse only when the text changes; the other values are read at that moment on purpose.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (text.trim() === '') return setPreview(null)
    const parsed = parsePublicKey(text)
    if (!parsed.ok) {
      // Never keep a private key on screen, not even long enough to fix a typo.
      if (parsed.error === 'private-key') setText('')
      return setPreview(parsed)
    }
    let cancelled = false
    factsForKey(parsed.key).then((facts) => {
      if (cancelled) return
      const duplicateOf = keys.some((key) => key.base64 === parsed.key.base64)
      const comment = cleanComment(parsed.key.comment)
      // The same guess the server makes when it stores the key.
      const icon = guessIcon({ type: parsed.key.type, comment })
      setPreview({ ok: true, key: parsed.key, facts, icon, duplicateOf })
      // The comment comes from the pasted line and can be changed before adding; the name is left
      // empty, so the key is called by its comment until it is given one.
      setComment(comment)
    })
    return () => {
      cancelled = true
    }
  }, [text])

  async function load(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`${file.name} is too big to be a public key.`)
      return
    }
    setFileError(null)
    setText(await file.text())
  }

  const keyError =
    fileError ??
    (preview && !preview.ok
      ? PARSE_ERROR_MESSAGES[preview.error]
      : preview?.ok && preview.duplicateOf
        ? 'You already added this key.'
        : null)
  const ready = preview?.ok === true && !keyError
  const parsed = preview?.ok && !keyError ? preview : null

  return (
    <fetcher.Form method="post" className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="intent" value="add" />
      {parsed ? (
        <input type="hidden" name="key" value={`${parsed.key.type} ${parsed.key.base64}`} />
      ) : null}
      <ResponsiveDialogBody>
        <FieldGroup className="gap-5">
          <Field data-invalid={Boolean(keyError) || undefined}>
            <span className="flex items-baseline justify-between gap-3">
              <FieldLabel htmlFor={ids.text}>Key</FieldLabel>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="text-muted-foreground text-xs hover:text-foreground"
              >
                Import .pub
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".pub,text/plain"
                hidden
                onChange={(event) => {
                  void load(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </span>
            <Textarea
              id={ids.text}
              value={text}
              onChange={(event) => {
                setFileError(null)
                setText(event.target.value)
              }}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes('Files')) return
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                if (!event.dataTransfer.files.length) return
                event.preventDefault()
                setDragging(false)
                void load(event.dataTransfer.files[0])
              }}
              rows={4}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              autoFocus
              placeholder={PLACEHOLDER}
              aria-invalid={Boolean(keyError) || undefined}
              className={cn(
                'min-h-28 resize-none break-all font-mono text-[13px] leading-relaxed',
                dragging && 'border-ring ring-3 ring-ring/30',
              )}
            />
            {keyError ? (
              <FieldError>{keyError}</FieldError>
            ) : parsed ? (
              <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-[13px]">
                <KeyAvatar icon={parsed.icon} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{parsed.facts.algorithm}</p>
                  <p className="break-all font-mono text-[12px] text-muted-foreground">
                    {parsed.facts.fingerprint}
                  </p>
                </div>
              </div>
            ) : null}
          </Field>

          {parsed ? (
            <>
              <Field>
                <FieldLabel htmlFor={ids.name}>Name</FieldLabel>
                <Input
                  id={ids.name}
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={LIMITS.keyName}
                  placeholder={comment.trim() || `${parsed.facts.algorithm} key`}
                />
              </Field>
              <Field>
                <span className="flex items-center gap-1.5">
                  <FieldLabel htmlFor={ids.comment}>Comment</FieldLabel>
                  <InfoTip label="About comment">
                    Not used by SSH, but may be convenient for identifying the key.
                  </InfoTip>
                </span>
                <GrowingTextarea
                  id={ids.comment}
                  name="comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  singleLine
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="you@laptop"
                  className="font-mono text-[13px] md:text-[13px]"
                />
              </Field>
              <Field>
                <span className="flex items-center gap-1.5">
                  <FieldLabel htmlFor={ids.note}>Note</FieldLabel>
                  <InfoTip label="About note">Only visible to you.</InfoTip>
                </span>
                <NoteInput id={ids.note} value={note} onChange={setNote} />
              </Field>
            </>
          ) : null}

          {serverError ? <p className="text-destructive text-sm">{serverError}</p> : null}
        </FieldGroup>
      </ResponsiveDialogBody>
      <ResponsiveDialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} className="sm:hidden">
          Cancel
        </Button>
        <Button type="submit" disabled={!ready || fetcher.state !== 'idle'}>
          Add SSH key
        </Button>
      </ResponsiveDialogFooter>
    </fetcher.Form>
  )
}
