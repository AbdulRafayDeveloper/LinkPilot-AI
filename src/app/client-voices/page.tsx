import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import ClientVoicesClient from "./ClientVoicesClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("client-voices")

export default async function Page() {
  await requireFeaturePage("client-voices", "/client-voices")
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
              { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE_URL}/` },
              { "@type": "ListItem", "position": 2, "name": "Client Voices to Tasks", "item": `${SITE_URL}/client-voices` },
            ],
          }),
        }}
      />
      <ClientVoicesClient />
    </>
  )
}
