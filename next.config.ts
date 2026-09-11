import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Prompt templates and dummy profiles are read from disk at runtime, so ship them with the API routes
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/prompts/**/*", "./src/data/**/*"],
  },
}

export default nextConfig;
