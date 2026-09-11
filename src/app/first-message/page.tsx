import type { Metadata } from "next"
import { SITE_NAME, SITE_URL } from "@/config/site"
import FirstMessageClient from "./FirstMessageClient"

export const metadata: Metadata = {
  title: `First Message | ${SITE_NAME}`,
  description: "Paste a LinkedIn profile, pick an outreach tune and generate a personalized first message in seconds.",
  alternates: {
    canonical: `${SITE_URL}/first-message`,
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
                "name": "First Message",
                "item": `${SITE_URL}/first-message`
              }
            ]
          })
        }}
      />
      <FirstMessageClient />
    </>
  )
}
