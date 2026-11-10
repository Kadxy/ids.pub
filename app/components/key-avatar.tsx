import {
  BotIcon,
  BriefcaseIcon,
  Building2Icon,
  CloudIcon,
  ContainerIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  GitBranchIcon,
  GlobeIcon,
  HouseIcon,
  KeyRoundIcon,
  LaptopIcon,
  type LucideIcon,
  MonitorIcon,
  RocketIcon,
  RouterIcon,
  ServerIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SquareTerminalIcon,
  UsbIcon,
} from 'lucide-react'
import type { KeyIcon } from '~/lib/directory'
import { cn } from '~/lib/utils'

/** Each icon is a Lucide glyph. */
export const KEY_GLYPHS: Record<KeyIcon, LucideIcon> = {
  key: KeyRoundIcon,
  laptop: LaptopIcon,
  desktop: MonitorIcon,
  phone: SmartphoneIcon,
  router: RouterIcon,
  'security-key': UsbIcon,
  server: ServerIcon,
  cloud: CloudIcon,
  container: ContainerIcon,
  database: DatabaseIcon,
  terminal: SquareTerminalIcon,
  bot: BotIcon,
  git: GitBranchIcon,
  briefcase: BriefcaseIcon,
  home: HouseIcon,
  building: Building2Icon,
  rocket: RocketIcon,
  shield: ShieldCheckIcon,
  globe: GlobeIcon,
  flask: FlaskConicalIcon,
}

export const KEY_ICON_LABELS: Record<KeyIcon, string> = {
  key: 'Key',
  laptop: 'Laptop',
  desktop: 'Desktop',
  phone: 'Phone',
  router: 'Router',
  'security-key': 'Security key',
  server: 'Server',
  cloud: 'Cloud',
  container: 'Container',
  database: 'Database',
  terminal: 'Terminal',
  bot: 'Bot',
  git: 'Git',
  briefcase: 'Work',
  home: 'Home',
  building: 'Office',
  rocket: 'Rocket',
  shield: 'Shield',
  globe: 'Globe',
  flask: 'Lab',
}

/** The glyph takes a little over half the tile, so it reads at a glance even when small. */
const SIZES = {
  sm: { box: 'size-6 rounded-md', glyph: 'size-3.5', stroke: 2.25 },
  md: { box: 'size-10 rounded-[11px]', glyph: 'size-[22px]', stroke: 2 },
  lg: { box: 'size-12 rounded-[14px]', glyph: 'size-6', stroke: 2 },
}

/**
 * A key's picture: its glyph on a light grey tile, the same for every key. ids.pub is a plain
 * thing, so the icons tell keys apart by shape alone, without colour.
 */
export function KeyAvatar({
  icon,
  size = 'md',
  className,
}: {
  icon: KeyIcon
  size?: keyof typeof SIZES
  className?: string
}) {
  const Glyph = KEY_GLYPHS[icon]
  const { box, glyph, stroke } = SIZES[size]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center bg-secondary text-foreground',
        box,
        className,
      )}
    >
      <Glyph className={glyph} strokeWidth={stroke} />
    </span>
  )
}
