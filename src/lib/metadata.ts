import type { Metadata } from "next"
import { env } from "@/config/env"
import { SITE_NAME } from "@/config/site"
import { getSeoPage, type SeoPage } from "@/constants/seo"

// The size of every card app/og/[slug] renders
const OG_IMAGE_SIZE = { width: 1200, height: 630 }

export const fullTitle = (page: SeoPage) => `${page.title} | ${SITE_NAME}`

/**
 * The link-preview tags for one page: Open Graph (WhatsApp, LinkedIn, Facebook, Slack, Discord,
 * Telegram, iMessage, Teams...) and the X card, both pointing at the page's own branded image.
 * Relative URLs resolve against the root layout's metadataBase (NEXT_PUBLIC_BASE_URL).
 */
export function socialMetadata(page: SeoPage): Pick<Metadata, "openGraph" | "twitter"> {
  const title = fullTitle(page)
  const image = { url: `/og/${page.slug}.png`, ...OG_IMAGE_SIZE, alt: `${page.heading}, ${SITE_NAME}`, type: "image/png" }
  const handle = env.TWITTER_HANDLE
  return {
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: page.path,
      title,
      description: page.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: page.description,
      images: [{ url: image.url, alt: image.alt }],
      ...(handle ? { site: handle, creator: handle } : {}),
    },
  }
}

/**
 * A page's complete metadata from its entry in constants/seo.ts: title (the layout adds
 * " | LinkPilot AI"), description, canonical URL, robots for private pages and link previews.
 * Next merges metadata shallowly, so each page sets the whole openGraph and twitter objects.
 */
export function pageMetadata(slug: string): Metadata {
  const page = getSeoPage(slug)
  if (!page) throw new Error(`constants/seo.ts has no page "${slug}"`)
  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords.length > 0 ? page.keywords : null,
    alternates: { canonical: page.path },
    ...(page.indexable ? {} : { robots: { index: false, follow: false } }),
    ...socialMetadata(page),
  }
}
