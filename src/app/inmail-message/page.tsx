import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import InMailClient from "./InMailClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("inmail-message")

export default async function Page() {
  await requireFeaturePage("inmail-composer", "/inmail-message")
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
