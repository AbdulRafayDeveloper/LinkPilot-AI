import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { SITE_URL } from "@/config/env"
import {
  BRAND_ICONS,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_LOGO_PNG,
  SITE_LOGO_SVG,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_THEME_COLOR,
} from "@/config/site"
import { HOME_SEO } from "@/constants/seo"
import { fullTitle, socialMetadata } from "@/lib/metadata"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

const pngIcon = ({ url, size }: { url: string; size: number }) => ({ url, sizes: `${size}x${size}`, type: "image/png" })

/**
 * Site-wide metadata. Each page adds its own title, description, canonical URL and link-preview
 * image (lib/metadata.ts); every icon here is the brand mark (public/, from `npm run brand:icons`),
 * and app/manifest.ts adds the installable-app manifest link.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: fullTitle(HOME_SEO), template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Each page replaces these with its own (constants/seo.ts)
  keywords: HOME_SEO.keywords,
  authors: [{ name: SITE_AUTHOR }],
  creator: SITE_AUTHOR,
  publisher: SITE_NAME,
  category: "productivity",
  formatDetection: { telephone: false, email: false, address: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: {
    // The SVG for modern browsers, sized PNGs for the rest, 192px for Android's tab and history
    icon: [
      { url: SITE_LOGO_SVG, type: "image/svg+xml" },
      ...BRAND_ICONS.sized.map(pngIcon),
      ...BRAND_ICONS.app.filter((icon) => icon.size === 192).map(pngIcon),
    ],
    shortcut: BRAND_ICONS.favicon,
    apple: [{ url: BRAND_ICONS.apple, sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: BRAND_ICONS.safariMask, color: SITE_THEME_COLOR }],
  },
  appleWebApp: { capable: true, title: SITE_SHORT_NAME, statusBarStyle: "default" },
  ...socialMetadata(HOME_SEO),
}

export const viewport: Viewport = {
  themeColor: SITE_THEME_COLOR,
  colorScheme: "light",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        {/* Structured Schema Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": SITE_NAME,
              "url": SITE_URL,
              "logo": `${SITE_URL}${SITE_LOGO_PNG}`,
            })
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
