import type { MetadataRoute } from "next";

/**
 * Public robots policy.
 *
 * The admin area is not implemented yet and must never be indexed once it
 * exists, so the whole surface is disallowed except the public page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/"],
      },
    ],
  };
}