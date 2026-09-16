export const SITE_NAME = "LinkPilot AI"
// The name where space is short: the home-screen label, the in-app wordmark
export const SITE_SHORT_NAME = "LinkPilot"
// What the app does, in a few words anyone understands; shown in the header of every page. It
// covers the whole app, not only the LinkedIn tools, because the sidebar now spans client work,
// meetings and the day's own workspace as well.
export const SITE_PURPOSE = "Outreach & Client Workspace"
export const SITE_DESCRIPTION =
  "One workspace for LinkedIn outreach and the client work that follows: post ideas and images, connection notes, comments, replies and follow-ups, plus client updates, meeting minutes, notes, tasks and files."
export const SITE_AUTHOR = "Abdul Rafay"

// The brand mark: a violet tile with the guiding star and a gold spark. The SVG is the source and
// the favicon; the 512px PNG serves the in-app logo. Every other icon in public/ is generated from
// the SVG by `npm run brand:icons` (scripts/generate-brand-icons.mjs).
export const SITE_LOGO_SVG = "/linkpilot-mark.svg"
export const SITE_LOGO_PNG = "/linkpilot-mark.png"

// Browser chrome, the installed app and its splash screen (the primary and background tokens)
export const SITE_THEME_COLOR = "#5b21b6"
export const SITE_BACKGROUND_COLOR = "#f7f6fa"

// Icons for the manifest and the page head, all in public/
export const BRAND_ICONS = {
  favicon: "/favicon.ico",
  sized: [16, 32, 48, 96].map((size) => ({ url: size === 96 ? "/favicon.png" : `/favicon-${size}x${size}.png`, size })),
  apple: "/apple-touch-icon.png",
  app: [48, 72, 96, 144, 192, 256, 384, 512].map((size) => ({ url: `/icon-${size}x${size}.png`, size })),
  maskable: [
    { url: "/maskable-icon.png", size: 192 },
    { url: "/maskable-icon-512x512.png", size: 512 },
  ],
  monochrome: { url: "/monochrome-icon.png", size: 512 },
  safariMask: "/safari-pinned-tab.svg",
} as const
