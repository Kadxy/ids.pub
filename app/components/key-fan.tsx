import {
  type DOMAttributes,
  type MouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { KeyAvatar } from '~/components/key-avatar'
import type { KeyIcon } from '~/lib/directory'
import { SITE_HOST } from '~/lib/site'
import { cn } from '~/lib/utils'

/** A box in the drawing. With `to`, it is a link to that page. */
interface FanNode {
  /** Unique across the whole drawing: the address, every key and every group. */
  id: string
  to?: string
}
export interface FanAddress extends FanNode {
  name: string
}
export interface FanKey extends FanNode {
  name: string
  icon: KeyIcon
  /** The algorithm, as the interface names it. */
  type: string
}
export interface FanGroup extends FanNode {
  name: string
  /** The ids of its keys. */
  keys: string[]
}

type Edge = [string, string]
type Lit = boolean | null
type Handlers = Pick<
  DOMAttributes<HTMLElement>,
  'onPointerEnter' | 'onPointerLeave' | 'onFocus' | 'onBlur' | 'onClick'
>

/**
 * An address over its keys, the groups under them. Every line runs from an address to a key it
 * has: down from the person's, up from a group's. Pointing at a key or an address draws its lines
 * again, darker, from the addresses toward the keys, and fades the rest.
 *
 * The home page's example arrives row by row with its lines drawing out (`intro`), and its rows
 * reach the column's edges. The Map page's are links, and its rows wrap when there are more keys or
 * groups than fit (`wrap`).
 */
export function KeyFan({
  address,
  keys,
  groups,
  intro = false,
  wrap = false,
}: {
  address: FanAddress
  keys: FanKey[]
  groups: FanGroup[]
  intro?: boolean
  wrap?: boolean
}) {
  const edges = useMemo<Edge[]>(
    () => [
      ...keys.map((key): Edge => [address.id, key.id]),
      ...groups.flatMap((group) => group.keys.map((key): Edge => [group.id, key])),
    ],
    [address.id, keys, groups],
  )

  const [pointed, setPointed] = useState<string | null>(null)
  const lit = (id: string): Lit => {
    if (pointed === null) return null
    if (pointed === id) return true
    if (keys.some((key) => key.id === pointed)) {
      return id === address.id || groups.some((g) => g.id === id && g.keys.includes(pointed))
    }
    const group = groups.find((entry) => entry.id === pointed)
    if (group) return group.keys.includes(id)
    return pointed === address.id && keys.some((key) => key.id === id)
  }
  const on = ([from, to]: Edge): Lit => {
    const [a, b] = [lit(from), lit(to)]
    return a === null ? null : Boolean(a && b)
  }

  // A mouse picks out what it is over. A link is also picked out while it has the keyboard's focus,
  // and a tap follows it. A box that isn't a link is picked out by a tap instead, until it is tapped
  // again or somewhere else is: there is no hover to end, and holding a finger down is not a gesture.
  const point = (node: FanNode): Handlers => {
    const hover = {
      onPointerEnter: (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse') setPointed(node.id)
      },
      onPointerLeave: (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse') setPointed(null)
      },
    }
    if (node.to) {
      return { ...hover, onFocus: () => setPointed(node.id), onBlur: () => setPointed(null) }
    }
    return {
      ...hover,
      onClick: (event: MouseEvent) => {
        if ((event.nativeEvent as PointerEvent).pointerType === 'mouse') return
        setPointed((current) => (current === node.id ? null : node.id))
      },
    }
  }
  // A touch outside the drawing's boxes clears it. pointerdown, not click: iOS Safari sends no
  // click for a tap on something that isn't a link or a button.
  useEffect(() => {
    if (pointed === null) return
    const clear = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return
      if (event.target instanceof Element && event.target.closest('[data-node]')) return
      setPointed(null)
    }
    document.addEventListener('pointerdown', clear)
    return () => document.removeEventListener('pointerdown', clear)
  }, [pointed])

  const { frame, place, paths } = useLines(edges, intro)

  const box = (node: FanNode, shape: string, children: ReactNode, title?: string) => (
    <Box node={node} place={place(node.id)} handlers={point(node)} shape={shape} title={title}>
      {children}
    </Box>
  )
  const rise = (delay: number, children: ReactNode) =>
    intro ? <Rise delay={delay}>{children}</Rise> : children
  const row = cn(
    'relative mt-10 flex sm:mt-12',
    wrap ? 'flex-wrap justify-evenly gap-x-3 gap-y-4' : 'justify-between',
  )

  return (
    <div ref={frame} className="relative">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        {edges.map((edge) => {
          const id = edge.join('>')
          const d = paths?.get(id)
          const state = on(edge)
          return d ? (
            <path
              key={id}
              data-edge={id}
              data-group={edge[0] === address.id ? undefined : ''}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className={cn(
                'transition-colors duration-300',
                state === false ? 'text-border' : 'text-input',
              )}
            />
          ) : null
        })}
        {/*
          The lines joined to what is pointed at, drawn over the rest from the address end. Keyed
          by what is pointed at, so pointing at something else draws them afresh.
        */}
        {edges
          .filter((edge) => on(edge) === true)
          .map((edge) => {
            const d = paths?.get(edge.join('>'))
            return d ? (
              <path
                key={`${pointed}:${edge.join('>')}`}
                ref={drawIn}
                d={d}
                pathLength={1}
                strokeDasharray="1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                className="text-foreground/70"
              />
            ) : null
          })}
      </svg>

      <div className="relative flex justify-center">
        {rise(
          0,
          box(
            address,
            'rounded-full',
            <Pill lit={lit(address.id)} pointed={pointed === address.id}>
              <span className="font-mono">
                <span className="text-faint">{SITE_HOST}/</span>
                {address.name}
              </span>
            </Pill>,
          ),
        )}
      </div>

      <ul aria-label="Keys" className={row}>
        {keys.map((key, index) => (
          <li key={key.id}>
            {rise(
              120 + index * 50,
              box(
                key,
                'rounded-xl',
                <span
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border bg-card py-1.5 pr-3 pl-1.5 shadow-[0_1px_0_0_var(--border)] transition-[opacity,translate,border-color] duration-300 max-sm:px-2 max-sm:py-1',
                    lit(key.id) === false && 'opacity-35',
                    pointed === key.id && '-translate-y-0.5 border-foreground/20',
                  )}
                >
                  <KeyAvatar icon={key.icon} size="sm" className="max-sm:hidden" />
                  <span className="grid">
                    <span className="max-w-36 truncate font-medium text-[12.5px] sm:text-[14px]">
                      {key.name}
                    </span>
                    <span className="whitespace-nowrap text-[11.5px] text-faint max-sm:hidden">
                      {key.type}
                    </span>
                  </span>
                </span>,
                key.to ? key.name : undefined,
              ),
            )}
          </li>
        ))}
      </ul>

      {groups.length > 0 ? (
        <ul aria-label="Groups" className={row}>
          {groups.map((group, index) => (
            <li key={group.id}>
              {rise(
                420 + index * 60,
                // An address like the person's, so the same outline and type. A row of names
                // under the keys reads as groups without a label.
                box(
                  group,
                  'rounded-full',
                  <Pill lit={lit(group.id)} pointed={pointed === group.id}>
                    <span className="block max-w-48 truncate font-mono">{group.name}</span>
                  </Pill>,
                  group.to ? group.name : undefined,
                ),
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Where a box is measured from, and what points at it: a link to its page, or just a box. */
function Box({
  node,
  place,
  handlers,
  shape,
  title,
  children,
}: {
  node: FanNode
  place: Ref<HTMLElement>
  handlers: Handlers
  /** The box's rounding, for the keyboard's focus ring. */
  shape: string
  title?: string
  children: ReactNode
}) {
  if (node.to) {
    return (
      <Link
        ref={place as Ref<HTMLAnchorElement>}
        to={node.to}
        prefetch="intent"
        title={title}
        data-node=""
        {...handlers}
        className={cn(
          'block outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          shape,
        )}
      >
        {children}
      </Link>
    )
  }
  return (
    <span ref={place} data-node="" {...handlers} className="block">
      {children}
    </span>
  )
}

/**
 * Draws a line in from its start, the address end, when it appears. Stable, so React calls it
 * once per line rather than on every render.
 */
const drawIn = (path: SVGPathElement | null) => {
  if (!path || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
    duration: 380,
    easing: 'cubic-bezier(0.3, 0.6, 0.2, 1)',
  })
}

/**
 * Rises into place on arrival, after `delay` ms. In CSS, so it starts with the page rather than
 * after scripts load, and only for those who don't ask for less motion.
 */
function Rise({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <span
      style={{ animationDelay: `${delay}ms` }}
      className="block motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:animate-in motion-safe:fill-mode-both motion-safe:duration-500 motion-safe:ease-out"
    >
      {children}
    </span>
  )
}

function Pill({
  lit,
  pointed = false,
  children,
}: {
  lit: Lit
  pointed?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'block whitespace-nowrap rounded-full border bg-background px-3 py-1.5 text-[12.5px] transition-[opacity,translate,border-color] duration-300 sm:px-3.5 sm:text-[13.5px]',
        lit === false && 'opacity-35',
        pointed && '-translate-y-0.5 border-foreground/20',
      )}
    >
      {children}
    </span>
  )
}

/** Where an element is laid out inside the frame: offsets ignore the rise's transform. */
function within(element: HTMLElement, frame: HTMLElement) {
  let left = 0
  let top = 0
  let node: HTMLElement | null = element
  while (node && node !== frame) {
    left += node.offsetLeft
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight }
}

/**
 * Where each box is, and for each edge a curve from the address to the middle of the key's near
 * side, in the frame's pixels. Measured after the page lays out, again when anything in the
 * drawing changes size (such as when the fonts arrive), and when the edges change. With `intro`,
 * the first time, the lines draw themselves out: the person's address's, then the groups'.
 */
function useLines(edges: Edge[], intro: boolean) {
  const frame = useRef<HTMLDivElement>(null)
  const boxes = useRef(new Map<string, HTMLElement>())
  const drawn = useRef(false)
  const [paths, setPaths] = useState<Map<string, string> | null>(null)
  // The same lines may come in a new array on every render; only a different set measures again.
  const current = useRef(edges)
  current.current = edges
  const signature = edges.map((edge) => edge.join('>')).join('\n')

  const place = useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (element) boxes.current.set(id, element)
      else boxes.current.delete(id)
    },
    [],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: measures again when the lines change
  useLayoutEffect(() => {
    const root = frame.current
    if (!root) return
    const measure = () => {
      const next = new Map<string, string>()
      for (const [from, to] of current.current) {
        const start = boxes.current.get(from)
        const end = boxes.current.get(to)
        if (!start || !end) continue
        const a = within(start, root)
        const b = within(end, root)
        // Down from the person's address to a key's top, or up from a group to a key's bottom.
        const down = a.top < b.top
        const x1 = a.left + a.width / 2
        const y1 = down ? a.top + a.height : a.top
        const x2 = b.left + b.width / 2
        const y2 = down ? b.top : b.top + b.height
        const bend = (y2 - y1) * 0.55
        next.set(`${from}>${to}`, `M${x1} ${y1} C${x1} ${y1 + bend} ${x2} ${y2 - bend} ${x2} ${y2}`)
      }
      setPaths(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    for (const box of boxes.current.values()) observer.observe(box)
    void document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [signature])

  useLayoutEffect(() => {
    const root = frame.current
    if (!intro || !paths || !root || drawn.current) return
    drawn.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const line of root.querySelectorAll<SVGPathElement>('path[data-edge]')) {
      const length = line.getTotalLength()
      line.animate(
        [
          { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
          { strokeDasharray: `${length}`, strokeDashoffset: '0' },
        ],
        {
          duration: 600,
          delay: line.hasAttribute('data-group') ? 750 : 300,
          easing: 'cubic-bezier(0.3, 0.6, 0.2, 1)',
          fill: 'backwards',
        },
      )
    }
  }, [paths, intro])

  return { frame, place, paths }
}
