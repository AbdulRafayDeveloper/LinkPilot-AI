import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Prompt templates are read from disk at runtime, so ship them with the API routes
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/prompts/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
}

export default nextConfig;
