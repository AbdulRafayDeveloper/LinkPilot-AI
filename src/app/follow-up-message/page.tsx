import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import FollowUpMessageClient from "./FollowUpMessageClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("follow-up-message")

export default async function Page() {
  await requireFeaturePage("follow-up-message", "/follow-up-message")
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
                "name": "Follow-Up Message",
                "item": `${SITE_URL}/follow-up-message`
              }
            ]
          })
        }}
      />
      <FollowUpMessageClient />
    </>
  )
}
