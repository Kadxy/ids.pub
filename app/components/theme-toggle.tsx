import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { ToggleGroup } from 'radix-ui'
import { useState } from 'react'
import { useRouteLoaderData } from 'react-router'
import { applyTheme, THEMES, type Theme } from '~/lib/theme'
import { cn } from '~/lib/utils'
import type { loader as rootLoader } from '~/root'

const ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon }
const LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }

/**
 * The three themes side by side, the chosen one raised: all three are in view, so choosing one is
 * one click and there is nothing to cycle through. In the account menu, and the home page's footer.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(
    useRouteLoaderData<typeof rootLoader>('root')?.theme ?? 'system',
  )
  return (
    <ToggleGroup.Root
      type="single"
      value={theme}
      onValueChange={(next) => {
        // Clicking the chosen one again sends an empty value; the theme stays as it is.
        if (!next) return
        setTheme(next as Theme)
        applyTheme(next as Theme)
      }}
      aria-label="Theme"
      className={cn('inline-flex items-center gap-0.5 rounded-full border p-0.5', className)}
    >
      {THEMES.map((entry) => {
        const Icon = ICONS[entry]
        return (
          <ToggleGroup.Item
            key={entry}
            value={entry}
            aria-label={LABELS[entry]}
            title={LABELS[entry]}
            className="grid size-6 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-[0_0_0_1px_var(--border)]"
          >
            <Icon className="size-3.5" />
          </ToggleGroup.Item>
        )
      })}
    </ToggleGroup.Root>
  )
}
