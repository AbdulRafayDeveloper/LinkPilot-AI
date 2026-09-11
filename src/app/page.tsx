import { redirect } from "next/navigation"
import { LINKEDIN_TOOLS } from "@/constants/linkedinTools"

// The app is the 8 LinkedIn tools; the root opens the first one
export default function Page() {
  redirect(LINKEDIN_TOOLS[0].href)
}
