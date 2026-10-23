import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Selbständiges Produktions-Bundle für das schlanke Docker-Image (Coolify)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
