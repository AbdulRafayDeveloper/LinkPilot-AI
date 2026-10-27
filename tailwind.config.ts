import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"

/**
 * Every colour token of the "Signal Violet & Gold" scheme. **Each one is a CSS variable**
 * (`--c-<name>` in globals.css, as space-separated RGB channels), set once for the light scheme and
 * once for the dark one, so the same class (`bg-surface-container-lowest`, `text-primary`) is right
 * in both and no component needs a `dark:` variant. Opacity still works (`bg-primary/10`) because
 * Tailwind fills in `<alpha-value>`. Add a colour here and in both blocks of globals.css together.
 */
const THEME_COLORS = [
  "secondary",
  "success",
  "error",
  "primary-hover",
  "primary",
  "on-primary",
  "on-primary-fixed-variant",
  "primary-container",
  "on-primary-container",
  "primary-fixed",
  "primary-fixed-dim",
  "inverse-primary",
  "surface-tint",
  "on-primary-fixed",
  "on-secondary",
  "secondary-container",
  "on-secondary-container",
  "secondary-fixed",
  "secondary-fixed-dim",
  "on-secondary-fixed",
  "on-secondary-fixed-variant",
  "tertiary",
  "on-tertiary",
  "tertiary-container",
  "on-tertiary-container",
  "tertiary-fixed",
  "tertiary-fixed-dim",
  "on-tertiary-fixed",
  "on-tertiary-fixed-variant",
  "background",
  "on-background",
  "surface",
  "surface-bright",
  "surface-dim",
  "surface-container-lowest",
  "surface-container-low",
  "surface-container",
  "surface-container-high",
  "surface-container-highest",
  "surface-variant",
  "on-surface",
  "on-surface-variant",
  "outline",
  "outline-variant",
  "inverse-surface",
  "inverse-on-surface",
  "ink",
  "on-success",
  "success-container",
  "on-success-container",
  "on-error",
  "error-container",
  "on-error-container",
] as const

const config: Config = {
  // The dark scheme is `data-theme="dark"` on <html>, set before the page paints (app/layout.tsx), so a
  // rare `dark:` variant follows the person's own choice rather than only the system setting
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // One violet brand family, neutral surfaces, a gold accent (Hot/Warm, warnings, moderate scores),
      // green for something finished and red for errors; the values live in globals.css
      colors: Object.fromEntries(THEME_COLORS.map((name) => [name, `rgb(var(--c-${name}) / <alpha-value>)`])),
      // As text, these four have a colour of their own: in the dark scheme a fill that carries white
      // text has to be deep and the same colour as text on black has to be light, and no one value is
      // both. In the light scheme each is the same as its fill (globals.css)
      textColor: Object.fromEntries(
        ["primary", "secondary", "success", "error"].map((name) => [name, `rgb(var(--c-${name}-text) / <alpha-value>)`])
      ),
      // The new-version notice rises into place (components/ui/UpdateToast.tsx), only where motion is welcome
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "toast-in": "toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      // Soft, ink-tinted shadows instead of flat grey ones
      boxShadow: {
        sm: "0 1px 2px 0 rgb(28 24 38 / 0.04), 0 1px 3px 0 rgb(28 24 38 / 0.05)",
        lg: "0 12px 32px -8px rgb(28 24 38 / 0.12), 0 4px 8px -4px rgb(28 24 38 / 0.06)",
        xl: "0 24px 48px -12px rgb(28 24 38 / 0.18), 0 8px 16px -8px rgb(28 24 38 / 0.08)",
      },
      spacing: {
        gutter: "24px",
        "margin-desktop": "40px",
        "margin-mobile": "16px",
        "stack-lg": "32px",
        "container-max": "1280px",
        "sidebar-width": "280px",
        "stack-sm": "8px",
        "stack-md": "16px",
      },
      fontFamily: {
        "label-md": ["Inter", "sans-serif"],
        "label-sm": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "headline-lg-mobile": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        code: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [
    // `short:` is a short laptop window: wide enough for the desktop layout, not tall enough for its full
    // spacing, so tools compact their option cards and spacing there to fit without scrolling. It is a
    // variant, not a `screens` entry: a raw screen would switch off the min-[…] and max-[…] width variants
    plugin(({ addVariant }) => {
      addVariant("short", "@media (min-width: 1024px) and (max-height: 860px)")
      // `tight:` is a short window of any width, phone or laptop: the sidebar's rows use it, because a
      // 640px-high phone has as little room for a list of nine tools as a 540px-high laptop does
      addVariant("tight", "@media (max-height: 740px)")
    }),
  ],
}
export default config
