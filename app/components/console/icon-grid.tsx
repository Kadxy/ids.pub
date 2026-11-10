import { RadioGroup } from 'radix-ui'
import { KEY_GLYPHS, KEY_ICON_LABELS } from '~/components/key-avatar'
import { KEY_ICONS, type KeyIcon } from '~/lib/directory'
import { cn } from '~/lib/utils'

/** A key's icon, ten to a row (five on phones). Arrow keys move between them. */
export function IconGrid({
  value,
  onChange,
}: {
  value: KeyIcon
  onChange: (icon: KeyIcon) => void
}) {
  return (
    <RadioGroup.Root
      aria-label="Icon"
      value={value}
      onValueChange={(icon) => onChange(icon as KeyIcon)}
      className="grid grid-cols-5 gap-1 sm:grid-cols-10"
    >
      {KEY_ICONS.map((icon) => {
        const Glyph = KEY_GLYPHS[icon]
        return (
          <RadioGroup.Item
            key={icon}
            value={icon}
            aria-label={KEY_ICON_LABELS[icon]}
            title={KEY_ICON_LABELS[icon]}
            className={cn(
              'grid size-9 place-items-center rounded-lg text-muted-foreground outline-none transition-colors',
              'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40',
              'data-[state=checked]:bg-secondary data-[state=checked]:text-foreground data-[state=checked]:ring-1 data-[state=checked]:ring-foreground/30',
            )}
          >
            <Glyph className="size-[18px]" />
          </RadioGroup.Item>
        )
      })}
    </RadioGroup.Root>
  )
}
