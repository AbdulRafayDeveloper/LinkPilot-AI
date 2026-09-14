"use client"

import { useEffect } from "react"
import { ArrowLeft, RotateCcw } from "lucide-react"
import { SITE_NAME } from "@/config/site"
import { HOME_HREF } from "@/components/ui/BrandLogo"
import { StatusPage } from "@/components/ui/StatusPage"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Replaces Next's default error screen for any page that throws while rendering
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Page error:", error)
  }, [error])

  return (
    <StatusPage
      code="Oops"
      title="Something went wrong"
      message="This page hit an unexpected error. Try again, or head back to your LinkedIn tools."
      primaryAction={{ label: "Try again", icon: RotateCcw, onClick: reset }}
      secondaryAction={{ label: `Back to ${SITE_NAME}`, icon: ArrowLeft, href: HOME_HREF }}
    />
  )
}
