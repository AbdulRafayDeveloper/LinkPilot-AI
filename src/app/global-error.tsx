"use client"

import { useEffect } from "react"
import { Inter } from "next/font/google"
import { ArrowLeft, RotateCcw } from "lucide-react"
import { SITE_NAME } from "@/config/site"
import { HOME_HREF } from "@/components/ui/BrandLogo"
import { StatusPage } from "@/components/ui/StatusPage"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], display: "swap" })

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Shown only when the root layout itself fails, so it brings its own <html> and styles
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("App error:", error)
  }, [error])

  return (
    <html lang="en" className={inter.className}>
      <head>
        <title>{`Something went wrong | ${SITE_NAME}`}</title>
      </head>
      <body>
        <StatusPage
          code="Oops"
          title="Something went wrong"
          message={`${SITE_NAME} couldn't load. Try again, or reload the page in a moment.`}
          primaryAction={{ label: "Try again", icon: RotateCcw, onClick: reset }}
          secondaryAction={{ label: `Back to ${SITE_NAME}`, icon: ArrowLeft, href: HOME_HREF }}
        />
      </body>
    </html>
  )
}
