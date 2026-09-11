import type { Metadata } from "next"
import { SITE_NAME, SITE_URL } from "@/config/site"
import AnalyticsClient from "./AnalyticsClient"

export const metadata: Metadata = {
  title: `Real-Time AI Operational Analytics | ${SITE_NAME}`,
  description: "Monitor LLM token expenditures, API response latencies, active user counts, and LangSmith observability health parameters in real time.",
  alternates: {
    canonical: `${SITE_URL}/analytics`,
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
                "name": "Analytics",
                "item": `${SITE_URL}/analytics`
              }
            ]
          })
        }}
      />
      <AnalyticsClient />
    </>
  )
}
