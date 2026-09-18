import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import TrendingHistoryClient from "./TrendingHistoryClient"
import { requireFeaturePage } from "@/app/featurePage"

export const metadata: Metadata = pageMetadata("trending-topics/history")

export default async function Page() {
  await requireFeaturePage("trending-topics", "/trending-topics")
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
              { "@type": "ListItem", "position": 2, "name": "Trending Topics", "item": `${SITE_URL}/trending-topics` },
              { "@type": "ListItem", "position": 3, "name": "Existing Trending Topics", "item": `${SITE_URL}/trending-topics/history` },
            ],
          }),
        }}
      />
      <TrendingHistoryClient />
    </>
  )
}
