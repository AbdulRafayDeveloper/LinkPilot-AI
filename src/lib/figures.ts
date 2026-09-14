// Figures that read as results or facts: percentages, multiples, counts, durations and money, in digits or
// words ("two weeks"); "one" is left out so phrasing like "one approach" isn't taken for a result
const FIGURE =
  /(?:[$€£]\s?)?(?:\d[\d,.]*|\b(?:two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\b)(?:\s*(?:-|–|to)\s*\d[\d,.]*)?\s*(?:%|percent\b|x\b|\+|[kKmM]\b|ms\b|milliseconds?\b|seconds?\b|secs?\b|minutes?\b|mins?\b|hours?\b|hrs?\b|days?\b|weeks?\b|months?\b|years?\b|users?\b|clients?\b|customers?\b|projects?\b|products?\b|MVPs?\b|teams?\b|companies\b)/gi

// Compares figures loosely: case, spacing, plural units and "percent" vs "%" don't matter ("3 Weeks" = "3 week")
const normalizeFigures = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/percent/g, "%")
    .replace(/(second|sec|minute|min|hour|hr|day|week|month|year|user|client|customer|project|product|mvp|team)s\b/g, "$1")

/**
 * Figures in the text (a number with its unit) that appear nowhere in the sources. These are
 * results the model made up. A figure worded differently from its source is flagged too,
 * which only costs a rewrite that uses the number as written in the source.
 */
export function findUnsupportedFigures(text: string, sourceText: string): string[] {
  const source = normalizeFigures(sourceText)
  const figures = [...text.matchAll(FIGURE)].map((match) => match[0].trim())
  return [...new Set(figures.filter((figure) => !source.includes(normalizeFigures(figure))))]
}
