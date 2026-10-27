import {
  COLOR_SCHEME_ATTRIBUTE,
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_COLOR_SCHEME,
  isColorScheme,
  SCHEME_BAR_COLORS,
  type AppliedScheme,
  type ColorScheme,
} from "@/constants/colorScheme"

/**
 * Applying the colour scheme. The choice lives on the account (Account Settings → Preferences) and
 * this browser keeps a copy, which the inline script in the page head reads before anything paints,
 * so a dark page never flashes white while the account loads. Once the account answers,
 * `useCurrentUser` hands its choice here, which is how a choice made on another device arrives.
 *
 * `data-theme` on <html> is always "light" or "dark": System is resolved against the device. The head
 * script also listens for the device switching between light and dark and resolves again from what is
 * stored, so System keeps following the device on every page, signed in or not.
 */

const DARK_QUERY = "(prefers-color-scheme: dark)"

export const resolveScheme = (choice: ColorScheme, deviceIsDark: boolean): AppliedScheme =>
  choice === "system" ? (deviceIsDark ? "dark" : "light") : choice

/** Shows the page in this scheme now and keeps it for the next page load. */
export function applyColorScheme(choice: ColorScheme | null | undefined): void {
  if (typeof window === "undefined") return
  const scheme = isColorScheme(choice) ? choice : DEFAULT_COLOR_SCHEME
  try {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme)
  } catch {
    // Blocked storage only costs the next page load its head start; the account still applies it
  }
  const applied = resolveScheme(scheme, window.matchMedia(DARK_QUERY).matches)
  const root = document.documentElement
  root.setAttribute(COLOR_SCHEME_ATTRIBUTE, applied)
  root.style.colorScheme = applied
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", SCHEME_BAR_COLORS[applied])
}

const KEY = JSON.stringify(COLOR_SCHEME_STORAGE_KEY)
const ATTRIBUTE = JSON.stringify(COLOR_SCHEME_ATTRIBUTE)

/**
 * The script the page head runs before it paints: the same rule as `applyColorScheme`, as plain
 * JavaScript because nothing else has loaded yet. Whatever goes wrong (no storage, no matchMedia), the
 * page simply starts in light.
 */
export const COLOR_SCHEME_SCRIPT = `(function(){try{var q=window.matchMedia(${JSON.stringify(DARK_QUERY)});
function pick(){var c=null;try{c=localStorage.getItem(${KEY})}catch(e){}return c==="dark"||c==="light"?c:(q.matches?"dark":"light")}
function set(){var a=pick(),r=document.documentElement;r.setAttribute(${ATTRIBUTE},a);r.style.colorScheme=a}
set();q.addEventListener("change",set)}catch(e){}})()`
