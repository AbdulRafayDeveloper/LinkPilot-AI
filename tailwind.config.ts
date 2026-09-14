import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Premium "Signal Violet & Gold" scheme: one violet brand family, violet-tinted porcelain
      // neutrals, a gold accent for warmth (Hot/Warm, warnings, moderate scores) and a red for errors.
      colors: {
        // Brand: violet
        primary: "#5b21b6",
        "on-primary": "#ffffff",
        "on-primary-fixed-variant": "#4c1d95",
        "primary-container": "#6d28d9",
        "on-primary-container": "#ede9fe",
        "primary-fixed": "#ddd6fe",
        "primary-fixed-dim": "#c4b5fd",
        "inverse-primary": "#c4b5fd",
        "surface-tint": "#6d28d9",
        "on-primary-fixed": "#2e1065",

        // Accent: gold
        secondary: "#b45309",
        "on-secondary": "#ffffff",
        "secondary-container": "#f59e0b",
        "on-secondary-container": "#451a03",
        "secondary-fixed": "#fef3c7",
        "secondary-fixed-dim": "#fde68a",
        "on-secondary-fixed": "#451a03",
        "on-secondary-fixed-variant": "#92400e",

        // Supporting: violet-gray
        tertiary: "#57536a",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#6f6a82",
        "on-tertiary-container": "#efecf6",
        "tertiary-fixed": "#e6e2f0",
        "tertiary-fixed-dim": "#c9c4d6",
        "on-tertiary-fixed": "#1e1a29",
        "on-tertiary-fixed-variant": "#484457",

        // Neutrals: porcelain with a violet undertone
        background: "#f7f6fa",
        "on-background": "#1c1826",
        surface: "#fcfbfe",
        "surface-bright": "#fcfbfe",
        "surface-dim": "#d9d4e3",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f6f4fa",
        "surface-container": "#efecf5",
        "surface-container-high": "#e8e4f0",
        "surface-container-highest": "#e1dcea",
        "surface-variant": "#e4e0ec",
        "on-surface": "#1c1826",
        "on-surface-variant": "#4a4658",
        outline: "#686477",
        "outline-variant": "#d6d2df",
        "inverse-surface": "#2b2636",
        "inverse-on-surface": "#f4f1f9",

        // Errors
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
      },
      // Soft, ink-tinted shadows instead of flat grey ones
      boxShadow: {
        sm: "0 1px 2px 0 rgb(28 24 38 / 0.04), 0 1px 3px 0 rgb(28 24 38 / 0.05)",
        lg: "0 12px 32px -8px rgb(28 24 38 / 0.12), 0 4px 8px -4px rgb(28 24 38 / 0.06)",
        xl: "0 24px 48px -12px rgb(28 24 38 / 0.18), 0 8px 16px -8px rgb(28 24 38 / 0.08)",
      },
      spacing: {
        gutter: "24px",
        "margin-desktop": "40px",
        "margin-mobile": "16px",
        "stack-lg": "32px",
        "container-max": "1280px",
        "sidebar-width": "280px",
        "stack-sm": "8px",
        "stack-md": "16px",
      },
      fontFamily: {
        "label-md": ["Inter", "sans-serif"],
        "label-sm": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "headline-lg-mobile": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        code: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
}
export default config
