import { redirect } from "next/navigation"
import { HOME_PATH } from "@/constants/auth"

// The root opens the home page. A temporary redirect (307), never a permanent one: a browser keeps a
// permanent redirect for good, which is how the root went on opening Trending Topics after the home
// page changed. A tool turned off for the account sends it on from there
export default function Page() {
  redirect(HOME_PATH)
}
