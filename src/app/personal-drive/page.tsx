import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { SITE_URL } from "@/config/env"
import PersonalDriveClient from "./PersonalDriveClient"
import { requireFeaturePage } from "@/app/featurePage"
import { PERSONAL_DRIVE_HREF } from "@/constants/importantFiles"

export const metadata: Metadata = pageMetadata("personal-drive")

/**
 * Personal Drive, which was Important Files until the owner asked for a drive. The tool's id is
 * still `important-files`, because that is what each account's own tool choices are stored against.
 */
export default async function Page() {
  await requireFeaturePage("important-files", PERSONAL_DRIVE_HREF)
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
              { "@type": "ListItem", "position": 2, "name": "Personal Drive", "item": `${SITE_URL}${PERSONAL_DRIVE_HREF}` },
            ],
          }),
        }}
      />
      <PersonalDriveClient />
    </>
  )
}
