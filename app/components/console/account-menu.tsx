import { useState } from 'react'
import { Form, Link, useNavigation } from 'react-router'
import { ResponsiveDialog, ResponsiveDialogFooter } from '~/components/responsive-dialog'
import { ThemeSwitch } from '~/components/theme-toggle'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { addressPath, displayAddress } from '~/lib/site'

const avatarUrl = (githubId: number) =>
  `https://avatars.githubusercontent.com/u/${githubId}?s=80&v=4`

/**
 * The avatar, and behind it a menu that says who is logged in. Without a name yet (still on the
 * welcome page), it only offers to log out.
 */
export function AccountMenu({ name, githubId }: { name: string | null; githubId: number }) {
  const [loggingOut, setLoggingOut] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account"
            className="ml-1 grid size-8 place-items-center rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:opacity-80"
          >
            <img
              src={avatarUrl(githubId)}
              alt=""
              width={28}
              height={28}
              draggable={false}
              className="size-7 rounded-full bg-muted"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-60">
          {name ? (
            <>
              <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
                <img
                  src={avatarUrl(githubId)}
                  alt=""
                  width={32}
                  height={32}
                  draggable={false}
                  className="size-8 shrink-0 rounded-full bg-muted"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground text-sm" title={name}>
                    {name}
                  </span>
                  <span
                    className="block truncate font-mono text-muted-foreground text-xs"
                    title={displayAddress(name)}
                  >
                    {displayAddress(name)}
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={addressPath(name)}>Public page</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {/* Not an item: choosing a theme leaves the menu open, to see the change. */}
          <div className="flex items-center justify-between py-1 pr-1 pl-1.5 text-sm">
            Theme
            <ThemeSwitch />
          </div>
          <DropdownMenuSeparator />
          {/* Let the menu finish closing first, so it hands focus to the dialog. */}
          <DropdownMenuItem onSelect={() => setTimeout(() => setLoggingOut(true))}>
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogOutDialog open={loggingOut} onOpenChange={setLoggingOut} />
    </>
  )
}

function LogOutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const busy = useNavigation().formAction === '/auth/sign-out'
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log out?"
      description="Only this browser is logged out. To come back, log in with GitHub."
      size="sm"
    >
      <Form method="post" action="/auth/sign-out">
        <ResponsiveDialogFooter className="mt-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Log out
          </Button>
        </ResponsiveDialogFooter>
      </Form>
    </ResponsiveDialog>
  )
}
