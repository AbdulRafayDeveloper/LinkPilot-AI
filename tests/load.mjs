// Loads the app's TypeScript modules for the tests (jiti is already installed with Tailwind), with the "@/" alias
import path from "node:path"
import { fileURLToPath } from "node:url"
import createJiti from "jiti"

const here = fileURLToPath(import.meta.url)
const src = path.resolve(path.dirname(here), "../src")
const jiti = createJiti(here, { alias: { "@": src }, interopDefault: true, cache: false, requireCache: false })

const load = (file) => jiti(path.join(src, file))

export default load
