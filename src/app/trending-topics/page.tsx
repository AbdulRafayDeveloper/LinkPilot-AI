import type { Metadata } from "next"
import { SITE_URL } from "@/config/env"
import { SITE_NAME } from "@/config/site"
import TrendingTopicsClient from "./TrendingTopicsClient"

export const metadata: Metadata = {
  title: `Trending Topics | ${SITE_NAME}`,
  description: "Discover fresh, source-backed web, AI and SaaS developments founders are discussing on LinkedIn, with ready-to-use searches and complete posts.",
  alternates: {
    canonical: `${SITE_URL}/trending-topics`,
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
                "name": "Trending Topics",
                "item": `${SITE_URL}/trending-topics`
              }
            ]
          })
        }}
      />
      <TrendingTopicsClient />
    </>
  )
}
