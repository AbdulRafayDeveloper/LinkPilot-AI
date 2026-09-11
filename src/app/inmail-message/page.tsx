import type { Metadata } from "next"
import { SITE_NAME, SITE_URL } from "@/config/site"
import InMailClient from "./InMailClient"

export const metadata: Metadata = {
  title: `InMail Message | ${SITE_NAME}`,
  description: "Paste a LinkedIn profile, pick an outreach tune and generate a personalized InMail subject and message.",
  alternates: {
    canonical: `${SITE_URL}/inmail-message`,
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
                "name": "InMail Message",
                "item": `${SITE_URL}/inmail-message`
              }
            ]
          })
        }}
      />
      <InMailClient />
    </>
  )
}
