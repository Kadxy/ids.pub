import type { ReactNode } from 'react'

/** One part of a settings form: a small heading, an optional line on what it means, its fields. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="font-medium text-sm">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-pretty text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
