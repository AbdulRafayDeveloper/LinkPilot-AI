import type { Metadata } from "next"
import { SITE_NAME, SITE_URL } from "@/config/site"
import WelcomeClient from "./WelcomeClient"

export const metadata: Metadata = {
  title: `${SITE_NAME} | Conversational Helpdesk Console`,
  description: "Deploy next-generation conversational AI support consoles. Securely troubleshoot enterprise incidents, run database queries, and manage tickets.",
  alternates: {
    canonical: `${SITE_URL}/`,
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
              }
            ]
          })
        }}
      />
      <WelcomeClient />
    </>
  )
}
