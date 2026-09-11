import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { SITE_URL } from "@/config/env"
import { SITE_NAME } from "@/config/site"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

const TITLE = `${SITE_NAME} | LinkedIn Outreach Tools`
const DESCRIPTION =
  "Eight AI tools for LinkedIn outreach: trending topics, connection notes, comments, comment replies, follow-ups, first messages, InMails and conversation replies."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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
              "logo": `${SITE_URL}/logo.png`,
            })
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
