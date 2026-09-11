import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Prompt templates are read from disk at runtime, so ship them with the API routes
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/prompts/**/*"],
  },
}

export default nextConfig;
