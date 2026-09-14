// Builds every icon the app serves from the one brand mark, public/linkpilot-mark.svg:
// favicons (ICO + PNG), Apple touch icons, Android/PWA icons, maskable and monochrome icons
// and the Safari pinned-tab mask. Run `npm run brand:icons` after changing the mark.
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const PUBLIC = path.join(process.cwd(), "public")
const source = await readFile(path.join(PUBLIC, "linkpilot-mark.svg"), "utf8")

const defs = source.match(/<defs>[\s\S]*?<\/defs>/)?.[0]
const glyph = source.match(/<path[\s\S]*?\/>/g)
if (!defs || !glyph || glyph.length < 2) throw new Error("linkpilot-mark.svg no longer has the expected <defs> and star paths")

// The star and spark together span x 13-54, y 10-55 of the 64 unit mark
const GLYPH_CENTER = { x: 33.5, y: 32.5 }
const placeGlyph = (scale, paths = glyph.join("\n")) =>
  `<g transform="translate(32 32) scale(${scale}) translate(${-GLYPH_CENTER.x} ${-GLYPH_CENTER.y})">${paths}</g>`
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}${body}</svg>`

// The full-bleed tile: an opaque square the platform masks itself (iOS rounds it, Android crops a circle or squircle)
const fullBleed = (scale) =>
  svg(`<rect width="64" height="64" fill="url(#lp-tile)"/><rect width="64" height="64" fill="url(#lp-sheen)"/>${placeGlyph(scale)}`)

const VARIANTS = {
  // The mark as designed: a rounded tile on transparency, for browsers and "any" purpose icons
  mark: source,
  // iOS fills transparent corners with black, so its icon is full bleed with a slightly smaller glyph
  apple: fullBleed(0.9),
  // Maskable: the glyph stays inside the 80% safe-zone circle every Android mask keeps
  maskable: fullBleed(0.78),
  // Monochrome (Android themed icons): one colour on transparency, alpha is all that counts
  monochrome: svg(placeGlyph(0.78, glyph.map((pathTag) => pathTag.replace(/fill="[^"]*"/, 'fill="#ffffff"')).join("\n"))),
}

const OUTPUTS = [
  ["favicon-16x16.png", "mark", 16],
  ["favicon-32x32.png", "mark", 32],
  ["favicon-48x48.png", "mark", 48],
  ["favicon.png", "mark", 96],
  ...[48, 72, 96, 144, 192, 256, 384, 512].map((size) => [`icon-${size}x${size}.png`, "mark", size]),
  ["apple-touch-icon.png", "apple", 180],
  ["apple-touch-icon-180x180.png", "apple", 180],
  ["maskable-icon.png", "maskable", 192],
  ["maskable-icon-512x512.png", "maskable", 512],
  ["monochrome-icon.png", "monochrome", 512],
]

// Full-bleed icons are saved without an alpha channel, so no platform can show a see-through edge
const OPAQUE = new Set(["apple", "maskable"])

const render = (variant, size) => {
  const image = sharp(Buffer.from(VARIANTS[variant]), { density: Math.max(72, (72 * size) / 64) * 2 }).resize(size, size)
  return (OPAQUE.has(variant) ? image.flatten({ background: "#3b0f7a" }) : image)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

for (const [file, variant, size] of OUTPUTS) {
  await writeFile(path.join(PUBLIC, file), await render(variant, size))
}

// favicon.ico with 16, 32 and 48 px PNG frames (every current browser reads PNG inside ICO)
const frames = await Promise.all([16, 32, 48].map((size) => render("mark", size).then((data) => ({ size, data }))))
const header = Buffer.alloc(6 + frames.length * 16)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(frames.length, 4)
let offset = header.length
frames.forEach(({ size, data }, index) => {
  const entry = 6 + index * 16
  header.writeUInt8(size, entry)
  header.writeUInt8(size, entry + 1)
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(data.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += data.length
})
await writeFile(path.join(PUBLIC, "favicon.ico"), Buffer.concat([header, ...frames.map((frame) => frame.data)]))

// Safari pinned tab: a single-colour silhouette; Safari paints it with the mask-icon colour
const silhouette = glyph.map((pathTag) => pathTag.replace(/fill="[^"]*"/, 'fill="#000000"')).join("")
await writeFile(path.join(PUBLIC, "safari-pinned-tab.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${placeGlyph(0.9, silhouette)}</svg>\n`)

console.log(`Brand icons written to public/: ${OUTPUTS.length} PNGs, favicon.ico, safari-pinned-tab.svg`)
