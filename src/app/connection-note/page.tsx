import type { Metadata } from "next"
import { SITE_URL } from "@/config/env"
import { SITE_NAME } from "@/config/site"
import ConnectionNoteClient from "./ConnectionNoteClient"

export const metadata: Metadata = {
  title: `Connection Note | ${SITE_NAME}`,
  description: "Paste a LinkedIn profile, pick a tone and generate a personalized connection request note in seconds.",
  alternates: {
    canonical: `${SITE_URL}/connection-note`,
  },
}

export default function Page() {
  return (
    <>
      {/* Breadcrumb schema markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": `${SITE_URL}/`
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Connection Note",
                "item": `${SITE_URL}/connection-note`
              }
            ]
          })
        }}
      />
      <ConnectionNoteClient />
    </>
  )
}
