export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]
export const isTheme = (value: unknown): value is Theme =>
  (THEMES as readonly unknown[]).includes(value)

export const THEME_COOKIE = 'ids_theme'

/** The class <html> carries for a theme. None follows the system, through a media query. */
export const themeClass = (theme: Theme) => (theme === 'system' ? undefined : theme)

/** Switches the page now, and remembers the choice in a cookie so the server renders it next time. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  const name = themeClass(theme)
  if (name) root.classList.add(name)
  // biome-ignore lint/suspicious/noDocumentCookie: one fixed name and value; the Cookie Store API is missing in older Safari
  document.cookie =
    theme === 'system'
      ? `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
      : `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
}
