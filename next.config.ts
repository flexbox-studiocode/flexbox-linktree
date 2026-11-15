import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  experimental: {
    serverActions: {
      // Media uploads go through a Server Action. The application limit is 5 MB
      // per file (`MAX_MEDIA_BYTES`); the extra megabyte covers multipart
      // boundaries and part headers, which also count toward this limit.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;