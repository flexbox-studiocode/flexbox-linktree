import { z } from "zod";

/** Mirrors the public icon names consumed by `src/components/public/link-icon.tsx`. */
export const linkIconSchema = z.enum([
  "grid",
  "spark",
  "globe",
  "book",
  "shape",
  "community",
  "mail",
]);

export const categorySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and dash-separated."),
    description: z.string().trim().max(280).nullable().optional(),
    icon: linkIconSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000),
    isActive: z.boolean().default(true),
  })
  .strict();

export type CategoryInput = z.infer<typeof categorySchema>;
