import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "@/config/env"
import { SITE_NAME, SITE_URL } from "@/config/site"
import { ScrollToTop } from "@/components/ui/ScrollToTop"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: `${SITE_NAME} | Conversational Helpdesk Intelligence`,
  description: "Next-generation conversational AI support console. Securely search knowledge base documents, trace real-time execution graphs, and resolve tickets.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: `${SITE_NAME} | Conversational Helpdesk Intelligence`,
    description: "Next-generation conversational AI support console. Securely search knowledge base documents, trace real-time execution graphs, and resolve tickets.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Conversational Helpdesk Intelligence`,
    description: "Next-generation conversational AI support console. Securely search knowledge base documents, trace real-time execution graphs, and resolve tickets.",
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
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+1-800-555-0199",
                "contactType": "customer service",
                "availableLanguage": ["en"]
              }
            })
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollToTop />
      </body>
    </html>
  )
}
