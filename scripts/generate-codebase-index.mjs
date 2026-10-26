// Writes CODEBASE_INDEX.md: a map of every module (its pages, its API, and the components,
// services and models those reach), then every source file with what its own doc comment says
// it is, what it exports and, for routes and pages, the address it serves. Everything is read
// from the code itself (the files, their imports, APP_TOOLS, FEATURE_API_PATHS and SEO_PAGES),
// so it can never drift from the app; run `npm run index:code` after adding or moving files.
//
//   node scripts/generate-codebase-index.mjs [--check]
//
// --check writes nothing and exits 1 when the index on disk is out of date.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname, basename } from "node:path"
import { fileURLToPath } from "node:url"
import createJiti from "jiti"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "src")
const OUT = join(ROOT, "CODEBASE_INDEX.md")
const SUMMARY_MAX = 220
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

/** The layers in the order a reader needs them, each with the one line that says what lives there. */
const SECTIONS = [
  ["src/app/api", "API routes", "Route handlers. Each starts with `requireViewer()`; the address is the folder."],
  ["src/app", "Pages", "Thin server `page.tsx` (metadata, feature guard) plus a `\"use client\"` `*Client.tsx`."],
  ["src/components", "Components", "Client UI, one folder per module; `ui/` is shared by every page."],
  ["src/hooks", "Hooks", "Client hooks: stores, lists, recorders, saved choices."],
  ["src/services", "Services", "Server logic per module, AI calls, storage, auth."],
  ["src/models", "Models", "Mongoose models, one per collection."],
  ["src/lib/validation", "Validation", "Zod schemas for every API input."],
  ["src/lib", "Lib", "Helpers shared by server and browser, mostly pure."],
  ["src/constants", "Constants", "Option lists, limits, messages, the navigation source."],
  ["src/types", "Types", "Shared TypeScript shapes."],
  ["src/config", "Config", "Env (server only) and site identity."],
  ["src", "Root of src", "The Next 16 proxy (middleware)."],
  ["scripts", "Scripts", "One-off database scripts and generators, run with node."],
]

const jiti = createJiti(join(ROOT, "package.json"), { alias: { "@": SRC }, interopDefault: true })
const load = (file) => jiti(join(SRC, file))
const { APP_TOOLS, TOOL_GROUPS } = load("constants/linkedinTools.ts")
const { FEATURE_API_PATHS, SHARED_API_PATHS } = load("constants/featureAccess.ts")
const { SEO_PAGES } = load("constants/seo.ts")
const seoByPath = new Map(Object.values(SEO_PAGES).map((page) => [page.path, page]))

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter((file) => /\.(ts|tsx|mjs)$/.test(file) && (file.startsWith("src/") || file.startsWith("scripts/")))
  .filter((file) => existsSync(join(ROOT, file)))
  .sort()

function cleanComment(text) {
  return text
    .replace(/^\/\*\*?|\*\/$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").replace(/^\s*\/\/\s?/, "").trim())
    .filter((line) => !line.startsWith("@") && !line.startsWith("eslint"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function shorten(text) {
  if (text.length <= SUMMARY_MAX) return text
  const cut = text.slice(0, SUMMARY_MAX)
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(": "))
  return end > 60 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`
}

/** The file's own comment: one at the top, or one standing before an export, an import or a blank line. */
function summaryOf(source) {
  const body = source.replace(/^#!.*\n/, "").replace(/^\s*["']use (client|server)["'];?\s*/, "")
  const candidates = []
  const lineRun = body.match(/^(?:[ \t]*\/\/.*\n){1,8}/m)
  if (lineRun && lineRun.index < 300) candidates.push({ text: lineRun[0], at: lineRun.index, top: true })
  for (const match of body.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
    const after = body.slice(match.index + match[0].length, match.index + match[0].length + 40)
    const top = /^\s*(export|import|\/\/|\/\*)/.test(after) || /^[ \t]*\n[ \t]*\n/.test(after)
    candidates.push({ text: match[0], at: match.index, top })
  }
  candidates.sort((a, b) => Number(b.top) - Number(a.top) || a.at - b.at)
  for (const candidate of candidates) {
    const text = cleanComment(candidate.text)
    if (text.length >= 12 && !/^(https?:|Breadcrumb)/.test(text)) return shorten(text)
  }
  return ""
}

function exportsOf(source) {
  const names = new Set()
  for (const match of source.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum|abstract class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(match[1])
  }
  for (const match of source.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, "")
      if (name) names.add(name)
    }
  }
  if (!names.size && /^export\s+default\s/m.test(source)) names.add("default")
  return [...names]
}

/** `@/services/meetings/x` → `services/meetings`, `@/models/Meeting` → `models/Meeting`. */
function importsOf(source) {
  const out = new Set()
  for (const match of source.matchAll(/from\s+["']@\/([\w-]+)\/([\w.-]+)(\/[\w./-]+)?["']/g)) {
    const [, layer, first] = match
    out.add(`${layer}/${first}`)
  }
  return out
}

const routeOf = (file) => file.replace(/^src\/app/, "").replace(/\/(route|page)\.tsx?$/, "") || "/"

const entries = files.map((file) => {
  // Line endings are read as \n, so a checkout with CRLF writes the same index as one without
  const source = readFileSync(join(ROOT, file), "utf8").replace(/\r\n/g, "\n")
  const exported = exportsOf(source)
  const lines = source.split("\n").length
  let summary = summaryOf(source)
  const entry = { file, exported, lines, imports: importsOf(source), extras: [] }
  if (/^src\/app\/.*route\.tsx?$/.test(file)) {
    entry.kind = "route"
    entry.path = routeOf(file)
    entry.methods = HTTP_METHODS.filter((method) => exported.includes(method))
    if (/withIdempotency\(/.test(source)) entry.extras.push("idempotent")
    if (/createSseResponse|text\/event-stream|lib\/sse/.test(source)) entry.extras.push("SSE")
    if (/export const maxDuration/.test(source)) entry.extras.push(`maxDuration ${source.match(/maxDuration\s*=\s*(\d+)/)?.[1] ?? ""}`.trim())
    if (/role:\s*"admin"/.test(source)) entry.extras.push("admin")
  } else if (/^src\/app\/.*page\.tsx$/.test(file)) {
    entry.kind = "page"
    entry.path = routeOf(file)
    const guard = source.match(/require(Feature|Admin)Page/)?.[0]
    if (guard) entry.extras.push(guard)
    const client = source.match(/import\s+(\w+Client)\s+from/)?.[1]
    const seo = seoByPath.get(entry.path)
    if (!summary && seo) summary = `**${seo.heading}**: ${seo.description}`
    if (!summary && client) summary = `Renders \`${client}\`.`
  } else if (/^src\/app\/.*Client\.tsx$/.test(file) && !summary) {
    const seo = seoByPath.get(routeOf(dirname(file)))
    summary = `The page's client UI${seo ? ` for **${seo.heading}**` : ""}.`
  }
  entry.summary = summary
  return entry
})

const cell = (text) => (text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")
const code = (items) => [...items].sort().map((item) => `\`${item}\``).join(", ")
const anchor = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/** What a module reaches, followed one step: its pages' components, its routes' services, those services' models. */
function reachOf(tool) {
  const pageDirs = [tool.href, ...(tool.links ?? []).map((link) => link.href)]
  const pageFiles = entries.filter((e) => e.file.startsWith("src/app/") && !e.file.startsWith("src/app/api/") &&
    pageDirs.some((href) => dirname(e.file) === `src/app${href}` || e.file.startsWith(`src/app${tool.href}/`)))
  // A tool the gate does not name (the admin area) is found by its pages' own addresses
  const apiPrefixes = FEATURE_API_PATHS[tool.id] ?? [...new Set(pageDirs.flatMap((href) => href.split("/").filter(Boolean).map((part) => `/api/${part}`)))]
    .filter((prefix) => entries.some((e) => e.kind === "route" && e.path.startsWith(`${prefix}/`) || e.path === prefix))
  const routes = entries.filter((e) => e.kind === "route" && apiPrefixes.some((prefix) => e.path === prefix || e.path.startsWith(`${prefix}/`)))
  const components = new Set()
  for (const page of pageFiles) for (const imp of page.imports) if (imp.startsWith("components/") && imp !== "components/ui") components.add(imp)
  const services = new Set()
  for (const route of routes) for (const imp of route.imports) if (imp.startsWith("services/")) services.add(imp)
  const models = new Set()
  const serviceFiles = entries.filter((e) => [...services].some((dir) => e.file === `src/${dir}.ts` || e.file.startsWith(`src/${dir}/`)))
  for (const file of [...serviceFiles, ...routes]) for (const imp of file.imports) if (imp.startsWith("models/")) models.add(imp.replace(/^models\//, ""))
  return { pageFiles, routes, apiPrefixes, components, services, models }
}

const out = []
const totalLines = entries.reduce((sum, e) => sum + e.lines, 0)
out.push("# Codebase index", "")
out.push("Generated by `npm run index:code` (`scripts/generate-codebase-index.mjs`) from the code itself. **Do not edit by hand**; rerun the script. `CLAUDE.md` explains *why* things are the way they are; this file says *where* everything is.", "")
out.push(`${entries.length} source files, ${totalLines.toLocaleString("en-US")} lines, ${entries.filter((e) => e.kind === "route").length} API routes, ${entries.filter((e) => e.kind === "page").length} pages.`, "")
out.push("- [Module map](#module-map): every tool in `APP_TOOLS`, with its pages, API, components, services and models")
out.push("- [Shared API paths](#shared-api-paths): routes that belong to no one tool")
for (const [prefix, title] of SECTIONS) out.push(`- [${title}](#${anchor(title)}) (\`${prefix}\`, ${entries.filter((e) => sectionOf(e.file) === prefix).length} files)`)
out.push("")

function sectionOf(file) {
  return SECTIONS.find(([prefix]) => file.startsWith(`${prefix}/`))?.[0] ?? "other"
}

out.push("## Module map", "")
const reaches = new Map(APP_TOOLS.map((tool) => [tool.id, reachOf(tool)]))
// Anything a third of the modules reach (auth, idempotency, the model order…) is plumbing, said once
const usage = new Map()
for (const reach of reaches.values()) {
  for (const item of [...reach.services, ...[...reach.models].map((m) => `models/${m}`)]) usage.set(item, (usage.get(item) ?? 0) + 1)
}
const plumbing = new Set([...usage].filter(([, count]) => count >= APP_TOOLS.length / 3).map(([item]) => item))
for (const reach of reaches.values()) {
  for (const item of plumbing) {
    reach.services.delete(item)
    reach.models.delete(item.replace(/^models\//, ""))
  }
}
out.push("Read from `APP_TOOLS` (sidebar order), `FEATURE_API_PATHS` and the imports of each module's pages and routes, one step deep. `components/ui` is left out, since every page uses it.", "")
out.push(`Reached by a third of the modules or more, so left off each one below: ${code(plumbing)}.`, "")
for (const group of TOOL_GROUPS) {
  const tools = APP_TOOLS.filter((tool) => tool.group === group.id)
  if (!tools.length) continue
  out.push(`### ${group.label}`, "", `${group.hint}.`, "")
  for (const tool of tools) {
    const reach = reaches.get(tool.id)
    const flags = [tool.adminOnly && "admin only", tool.primaryOnly && "primary accounts only"].filter(Boolean)
    out.push(`#### ${tool.title}${flags.length ? ` (${flags.join(", ")})` : ""}`, "")
    out.push(`${tool.description}. Feature id \`${tool.id}\`.`, "")
    const pages = entries.filter((e) => e.kind === "page" && (e.path === tool.href || e.path.startsWith(`${tool.href}/`) || (tool.links ?? []).some((l) => l.href === e.path)))
    out.push(`- **Pages:** ${pages.length ? pages.map((p) => `[\`${p.path}\`](${p.file})`).join(", ") : `\`${tool.href}\``}`)
    if (reach.apiPrefixes.length) out.push(`- **API:** ${code(reach.apiPrefixes)} (${reach.routes.length} route files)`)
    if (reach.components.size) out.push(`- **Components:** ${code(reach.components)}`)
    if (reach.services.size) out.push(`- **Services:** ${code(reach.services)}`)
    if (reach.models.size) out.push(`- **Models:** ${code(reach.models)}`)
    out.push("")
  }
}

out.push("## Shared API paths", "")
out.push("`SHARED_API_PATHS` in `constants/featureAccess.ts`: no tool switch covers these.", "")
out.push(code(SHARED_API_PATHS), "")

for (const [prefix, title, about] of SECTIONS) {
  const list = entries.filter((e) => sectionOf(e.file) === prefix)
  if (!list.length) continue
  out.push(`## ${title}`, "", about, "")
  const folders = new Map()
  for (const entry of list) {
    const depth = prefix.split("/").length + 1
    const folder = prefix.startsWith("src/app") ? entry.file.split("/").slice(0, depth).join("/").replace(/\.tsx?$/, "") : dirname(entry.file)
    const key = folder.endsWith(".ts") || folder.endsWith(".tsx") || folder === entry.file ? prefix : folder
    if (!folders.has(key)) folders.set(key, [])
    folders.get(key).push(entry)
  }
  for (const [folder, group] of folders) {
    if (folders.size > 1) out.push(`### \`${folder}\``, "")
    if (prefix === "src/app/api") {
      out.push("| Route | Notes | What it does |", "|---|---|---|")
      for (const e of group) out.push(`| [\`${e.methods.join(" ") || "?"}\` ${e.path}](${e.file}) | ${e.extras.join(", ")} | ${cell(e.summary)} |`)
    } else if (prefix === "src/app") {
      out.push("| File | Serves | What it is |", "|---|---|---|")
      for (const e of group) {
        const serves = e.kind === "page" ? `\`${e.path}\`${e.extras.length ? ` (${e.extras.join(", ")})` : ""}` : ""
        out.push(`| [${e.file.replace(/^src\/app\//, "")}](${e.file}) | ${serves} | ${cell(e.summary)} |`)
      }
    } else {
      out.push("| File | Exports | What it is |", "|---|---|---|")
      for (const e of group) {
        const names = e.exported.slice(0, 10).map((name) => `\`${name}\``).join(", ") + (e.exported.length > 10 ? ` +${e.exported.length - 10}` : "")
        out.push(`| [${basename(e.file)}](${e.file}) | ${names} | ${cell(e.summary)} |`)
      }
    }
    out.push("")
  }
}

const text = `${out.join("\n").trimEnd()}\n`
if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : ""
  if (current !== text) {
    console.error("CODEBASE_INDEX.md is out of date. Run npm run index:code.")
    process.exit(1)
  }
  console.log("CODEBASE_INDEX.md is up to date.")
} else {
  writeFileSync(OUT, text)
  const blank = entries.filter((e) => !e.summary).length
  console.log(`Wrote CODEBASE_INDEX.md: ${entries.length} files, ${blank} without a doc comment.`)
}
