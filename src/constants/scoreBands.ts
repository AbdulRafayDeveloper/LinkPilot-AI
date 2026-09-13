/**
 * How a 0–100 signal score reads, highest band first. Shared by every tool that scores a
 * lead or conversation, so the same number always means the same thing.
 */
export const SCORE_BANDS = [
  { min: 81, label: "Very strong" },
  { min: 61, label: "Strong" },
  { min: 41, label: "Moderate" },
  { min: 21, label: "Low" },
  { min: 0, label: "Very weak" },
] as const

export function getScoreBand(score: number): (typeof SCORE_BANDS)[number] {
  return SCORE_BANDS.find((band) => score >= band.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1]
}

/**
 * Clamps a model-produced score to a whole number from 0 to 100.
 */
export function toScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}
