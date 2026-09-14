import { permanentRedirect } from "next/navigation"
import { LINKEDIN_TOOLS } from "@/constants/linkedinTools"

// The app is the 8 LinkedIn tools; the root opens the first one (308, so search engines move to it)
export default function Page() {
  permanentRedirect(LINKEDIN_TOOLS[0].href)
}
