import { MetadataRoute } from "next"
import { SITE_URL } from "@/config/env"
import { PUBLIC_TOOLS } from "@/constants/linkedinTools"

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_TOOLS.map((tool) => ({
    url: `${SITE_URL}${tool.href}`,
    lastModified: new Date(),
    changeFrequency: tool.id === "trending-topics" ? "daily" : "monthly",
    priority: tool.id === "trending-topics" ? 0.9 : 0.8,
  }))
}
