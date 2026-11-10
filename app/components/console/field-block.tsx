import type { ReactNode } from 'react'
import { InfoTip } from '~/components/info-tip'

/** A label over its control, as in a compact form. `htmlFor` ties the label to an input. */
export function FieldBlock({
  label,
  htmlFor,
  hint,
  aside,
  children,
}: {
  label: string
  htmlFor?: string
  /** One sentence about the field, behind an icon beside the label. */
  hint?: string
  /** A small extra on the label's line, on the right. */
  aside?: ReactNode
  children: ReactNode
}) {
  const Label = htmlFor ? 'label' : 'p'
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5">
          <Label htmlFor={htmlFor} className="font-medium text-sm">
            {label}
          </Label>
          {hint ? <InfoTip label={`About ${label.toLowerCase()}`}>{hint}</InfoTip> : null}
        </span>
        {aside}
      </div>
      {children}
    </div>
  )
}
