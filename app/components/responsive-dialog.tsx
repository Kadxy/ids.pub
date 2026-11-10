import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { cn } from '~/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from './ui/drawer'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet'

const DESKTOP_QUERY = '(min-width: 640px)'
type Layout = 'dialog' | 'sheet' | 'drawer'
const LayoutContext = createContext<Layout>('dialog')

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return desktop
}

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Desktop width. Phones always get a bottom drawer. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** On desktop, a panel along the right edge instead of a centred dialog: for longer forms. */
  sheet?: boolean
  /**
   * Focus the dialog itself on open instead of its first control. For dialogs with nothing to fill
   * in, where a focus ring on the close button would be the loudest thing on screen.
   */
  focusDialog?: boolean
}

const WIDTHS = {
  sm: 'sm:max-w-[26rem]',
  md: 'sm:max-w-[32rem]',
  lg: 'sm:max-w-[38rem]',
  xl: 'sm:max-w-[48rem]',
}

/**
 * The same content as a centred dialog (or a right-hand panel) on desktop, and as a bottom drawer
 * on phones.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  sheet = false,
  focusDialog = false,
}: ResponsiveDialogProps) {
  const onOpenAutoFocus = focusDialog
    ? (event: Event) => {
        event.preventDefault()
        ;(event.currentTarget as HTMLElement | null)?.focus()
      }
    : undefined
  const desktop = useIsDesktop()
  const heading = 'text-[17px] [overflow-wrap:anywhere]'

  if (desktop && sheet) {
    return (
      <LayoutContext.Provider value="sheet">
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            onOpenAutoFocus={onOpenAutoFocus}
            className={cn(
              'gap-0 overflow-hidden outline-none data-[side=right]:w-full data-[side=right]:sm:m-2 data-[side=right]:sm:h-[calc(100%-1rem)] sm:rounded-xl sm:border [&>*]:min-w-0',
              'data-[side=right]:sm:max-w-[34rem]',
            )}
          >
            <SheetHeader className="px-6 pt-6 pb-0">
              <SheetTitle className={heading}>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </SheetHeader>
            {children}
          </SheetContent>
        </Sheet>
      </LayoutContext.Provider>
    )
  }

  if (desktop) {
    return (
      <LayoutContext.Provider value="dialog">
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            onOpenAutoFocus={onOpenAutoFocus}
            className={cn('gap-0 overflow-hidden p-0 outline-none [&>*]:min-w-0', WIDTHS[size])}
          >
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className={heading}>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
            {children}
          </DialogContent>
        </Dialog>
      </LayoutContext.Provider>
    )
  }

  return (
    <LayoutContext.Provider value="drawer">
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] [&>*]:min-w-0">
          <DrawerHeader className="text-left">
            <DrawerTitle className={heading}>{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
    </LayoutContext.Provider>
  )
}

const BODY: Record<Layout, string> = {
  dialog: 'max-h-[65dvh] px-6 pt-5 pb-6',
  sheet: 'flex-1 px-6 pt-5 pb-6',
  drawer: 'px-4 pb-2',
}

export function ResponsiveDialogBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const layout = useContext(LayoutContext)
  return <div className={cn('min-h-0 overflow-y-auto', BODY[layout], className)}>{children}</div>
}

/**
 * Buttons in reading order, primary last: it sits on the right on desktop and on top on phones.
 * `start` goes to the far left on desktop, for a secondary action that isn't Cancel.
 */
export function ResponsiveDialogFooter({
  children,
  start,
  className,
}: {
  children: ReactNode
  start?: ReactNode
  className?: string
}) {
  const layout = useContext(LayoutContext)
  if (layout === 'drawer') {
    return (
      <DrawerFooter className={cn('flex-col-reverse pt-3 [&>*]:h-11 [&>*]:w-full', className)}>
        {start}
        {children}
      </DrawerFooter>
    )
  }
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t bg-muted/50 px-6 py-3.5',
        layout === 'sheet' && 'mt-auto',
        className,
      )}
    >
      {start ? <div className="mr-auto flex min-w-0 items-center gap-3">{start}</div> : null}
      {children}
    </div>
  )
}
