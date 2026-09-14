import type { MetadataRoute } from "next"
import { LINKEDIN_TOOLS } from "@/constants/linkedinTools"
import {
  BRAND_ICONS,
  SITE_BACKGROUND_COLOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_THEME_COLOR,
} from "@/config/site"

const png = ({ url, size }: { url: string; size: number }, purpose: "any" | "maskable" | "monochrome") => ({
  src: url,
  sizes: `${size}x${size}`,
  type: "image/png",
  purpose,
})

/**
 * The installable-app manifest (served at /manifest.webmanifest; /manifest.json and
 * /site.webmanifest point here too). Every icon is the brand mark: regular sizes for launchers
 * and the splash screen, maskable ones Android can crop to any shape, and a monochrome one for
 * themed icons. A long press on the installed app offers each tool as a shortcut.
 */
export default function manifest(): MetadataRoute.Manifest {
  const shortcutIcon = BRAND_ICONS.app.filter((icon) => icon.size === 96).map((icon) => png(icon, "any"))
  return {
    id: "/",
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "en",
    dir: "ltr",
    background_color: SITE_BACKGROUND_COLOR,
    theme_color: SITE_THEME_COLOR,
    categories: ["productivity", "business", "social"],
    icons: [
      ...BRAND_ICONS.app.map((icon) => png(icon, "any")),
      ...BRAND_ICONS.maskable.map((icon) => png(icon, "maskable")),
      png(BRAND_ICONS.monochrome, "monochrome"),
    ],
    shortcuts: LINKEDIN_TOOLS.map((tool) => ({
      name: tool.title,
      short_name: tool.title,
      description: tool.description,
      url: tool.href,
      icons: shortcutIcon,
    })),
  }
}
