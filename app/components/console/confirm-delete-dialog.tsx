import { TriangleAlertIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useFetcher } from 'react-router'
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '~/components/responsive-dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "key" or "group", for the copy. */
  what: string
  /** The name the person has to type. */
  name: string
  consequence: React.ReactNode
  /** Posted along with intent=delete and confirm=<typed name>. */
  action?: string
  fields?: Record<string, string>
  /**
   * A phrase to type as well, in a second field posted as `phrase`, for what can't be undone at all,
   * such as the account: GitHub asks the same before deleting one.
   */
  phrase?: string
}

/** Deleting is deliberate: the person types the exact name, as on GitHub, and for some a phrase too. */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  what,
  name,
  consequence,
  action,
  fields = {},
  phrase,
}: ConfirmDeleteDialogProps) {
  const ids = { name: useId(), phrase: useId() }
  const fetcher = useFetcher()
  const [typed, setTyped] = useState('')
  const [typedPhrase, setTypedPhrase] = useState('')
  useEffect(() => {
    if (open) {
      setTyped('')
      setTypedPhrase('')
    }
  }, [open])
  const matches = typed === name && (!phrase || typedPhrase === phrase)

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={`Delete ${what}`} size="sm">
      <fetcher.Form method="post" action={action}>
        <input type="hidden" name="intent" value="delete" />
        {Object.entries(fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <ResponsiveDialogBody>
          <div className="flex gap-2.5 rounded-lg bg-destructive/[0.07] px-3 py-2.5 text-sm text-destructive">
            <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div>{consequence}</div>
          </div>
          <label htmlFor={ids.name} className="mt-5 block text-sm">
            To confirm, type <span className="font-medium [overflow-wrap:anywhere]">{name}</span>
          </label>
          <Input
            id={ids.name}
            name="confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            className="mt-2"
          />
          {phrase ? (
            <>
              <label htmlFor={ids.phrase} className="mt-4 block text-sm">
                Then type <span className="font-medium">{phrase}</span>
              </label>
              <Input
                id={ids.phrase}
                name="phrase"
                value={typedPhrase}
                onChange={(event) => setTypedPhrase(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                className="mt-2"
              />
            </>
          ) : null}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!matches || fetcher.state !== 'idle'}
            className="bg-destructive text-white hover:bg-destructive/90 dark:text-background"
          >
            Delete {what}
          </Button>
        </ResponsiveDialogFooter>
      </fetcher.Form>
    </ResponsiveDialog>
  )
}
