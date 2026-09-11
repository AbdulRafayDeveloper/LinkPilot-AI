import type { Metadata } from "next"
import { SITE_URL } from "@/config/env"
import { SITE_NAME } from "@/config/site"
import FollowUpMessageClient from "./FollowUpMessageClient"

export const metadata: Metadata = {
  title: `Follow-Up Message | ${SITE_NAME}`,
  description: "Paste your previous LinkedIn conversation, choose a pitch or non-pitch follow-up and generate a natural next message.",
  alternates: {
    canonical: `${SITE_URL}/follow-up-message`,
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
