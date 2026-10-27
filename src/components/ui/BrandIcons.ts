import { createLucideIcon } from "lucide-react"

/**
 * The marks of the platforms the upcoming areas are for, built with `createLucideIcon` the way
 * `LinkedInIcon` is (lucide-react ships no brand marks), so each takes the same props, sizing and
 * `className` as every other icon on the sidebar's rail and colours itself with `currentColor`.
 *
 * Upwork's and Fiverr's paths are Simple Icons' (CC0-1.0, simpleicons.org), filled rather than
 * stroked because that is how the marks are drawn. Fiverr's is only the "fi" of its wordmark, scaled
 * to fill the square: the whole "fiverr." is unreadable at the rail's 19px, while "fi" is the
 * platform's own app icon. Simple Icons has no Hubstaff mark, so Hubstaff Talent is its "H" in a
 * rounded square, drawn in lucide's own stroke style.
 */

const FILLED = { fill: "currentColor", stroke: "none" }

export const UpworkIcon = createLucideIcon("Upwork", [
  [
    "path",
    {
      d: "M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-1.076.008-.042c.207-1.143.849-3.06 2.839-3.06 1.492 0 2.703 1.212 2.703 2.703-.001 1.489-1.212 2.702-2.704 2.702zm0-8.14c-2.539 0-4.51 1.649-5.31 4.366-1.22-1.834-2.148-4.036-2.687-5.892H7.828v7.112c-.002 1.406-1.141 2.546-2.547 2.548-1.405-.002-2.543-1.143-2.545-2.548V3.492H0v7.112c0 2.914 2.37 5.303 5.281 5.303 2.913 0 5.283-2.389 5.283-5.303v-1.19c.529 1.107 1.182 2.229 1.974 3.221l-1.673 7.873h2.797l1.213-5.71c1.063.679 2.285 1.109 3.686 1.109 3 0 5.439-2.452 5.439-5.45 0-3-2.439-5.439-5.439-5.439z",
      ...FILLED,
      key: "upwork-mark",
    },
  ],
])

export const FiverrIcon = createLucideIcon("Fiverr", [
  [
    "path",
    {
      d: "M.908 15.44H2.51v-3.558h1.524v3.558h1.591v-4.874H2.51v-.302c0-.332.235-.536.606-.536h.918V8.412H2.85c-1.162 0-1.943.712-1.943 1.755v.4H0v1.316h.908v3.558z",
      transform: "translate(4.7 -19) scale(2.6)",
      ...FILLED,
      key: "fiverr-fi",
    },
  ],
])

export const HubstaffIcon = createLucideIcon("Hubstaff", [
  ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "5", key: "hubstaff-tile" }],
  ["path", { d: "M9 7.5v9M15 7.5v9M9 12h6", key: "hubstaff-h" }],
])
