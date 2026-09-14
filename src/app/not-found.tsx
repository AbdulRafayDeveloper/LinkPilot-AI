import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { SITE_NAME } from "@/config/site"
import { HOME_HREF } from "@/components/ui/BrandLogo"
import { StatusPage } from "@/components/ui/StatusPage"

// The root title template adds " | LinkPilot AI"
export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      message="This page doesn't exist or has moved. Your LinkedIn tools are one click away."
      primaryAction={{ label: `Back to ${SITE_NAME}`, icon: ArrowLeft, href: HOME_HREF }}
    />
  )
}
