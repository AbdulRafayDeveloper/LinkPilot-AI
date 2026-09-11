import { MetadataRoute } from "next"
import { SITE_NAME } from "@/config/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "LinkPilot",
    description: "Eight AI tools for LinkedIn outreach, from trending topics to conversation replies.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#005c55",
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
