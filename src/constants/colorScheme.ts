/**
 * The colour scheme a person chooses in Account Settings → Preferences. **System is the default**: it
 * follows the device's own light or dark setting, and keeps following it if the device switches.
 * Light and Dark hold whatever the device says. The choice is saved on the account, so it follows the
 * person to any browser (lib/colorScheme.ts applies it, app/globals.css holds both palettes).
 *
 * This file is read by the inline script in the page head as well, so keep it free of `@/` imports.
 */

export const COLOR_SCHEMES = [
  { id: "system", label: "System", description: "Follows your device's light or dark setting" },
  { id: "light", label: "Light", description: "Light pages, whatever the device says" },
  { id: "dark", label: "Dark", description: "Jet black pages with clear text, like an iPhone" },
] as const

export type ColorScheme = (typeof COLOR_SCHEMES)[number]["id"]
// What is applied, once System has been resolved against the device
export type AppliedScheme = "light" | "dark"

export const DEFAULT_COLOR_SCHEME: ColorScheme = "system"
export const COLOR_SCHEME_IDS = COLOR_SCHEMES.map((scheme) => scheme.id) as [ColorScheme, ...ColorScheme[]]
export const isColorScheme = (value: unknown): value is ColorScheme => COLOR_SCHEME_IDS.includes(value as ColorScheme)

// This browser's copy of the choice, read before the page paints so a dark page never flashes white
export const COLOR_SCHEME_STORAGE_KEY = "linkpilot:color-scheme"
// The attribute on <html> that globals.css switches the palette on
export const COLOR_SCHEME_ATTRIBUTE = "data-theme"
// The bar colour a phone's browser draws around the page in each scheme
export const SCHEME_BAR_COLORS: Record<AppliedScheme, string> = { light: "#5b21b6", dark: "#000000" }

export const COLOR_SCHEME_MESSAGES = {
  title: "Appearance",
  hint: "How the app looks. System follows your device, and your choice is saved to your account.",
  legend: "Colour scheme",
  saved: "Your colour scheme is saved.",
  failed: "Couldn't save your colour scheme. Please try again.",
  unknown: "That isn't a colour scheme this app has.",
} as const
