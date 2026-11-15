import { z } from "zod";

import { approvedInternalAnchors, destinationTypeSchema } from "@/features/content/schemas/destination";
import { isAllowedDestinationUrl } from "@/lib/utils/url";
import { linkIconSchema } from "@/features/content/schemas/category";

export const publicationStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const linkSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and dash-separated."),
    categoryId: z.string().uuid(),
    title: z.string().trim().min(1, "Title is required.").max(160),
    description: z.string().trim().max(500).nullable().optional(),
    icon: linkIconSchema.nullable().optional(),
    tag: z.string().trim().max(40).nullable().optional(),
    destinationType: destinationTypeSchema,
    destinationUrl: z.string().trim().min(1).max(2_048).nullable().optional(),
    internalAnchor: z.enum(approvedInternalAnchors).nullable().optional(),
    status: publicationStatusSchema.default("DRAFT"),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(10_000),
    publishedAt: z.date().nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.destinationType === "EXTERNAL") {
      if (!value.destinationUrl || !isAllowedDestinationUrl(value.destinationUrl)) {
        context.addIssue({ code: "custom", path: ["destinationUrl"], message: "External destinations require a valid HTTP(S) or mailto URL." });
      }
      if (value.internalAnchor) {
        context.addIssue({ code: "custom", path: ["internalAnchor"], message: "External destinations cannot include an internal anchor." });
      }
    }
    if (value.destinationType === "INTERNAL" && (!value.internalAnchor || value.destinationUrl)) {
      context.addIssue({ code: "custom", path: ["internalAnchor"], message: "Internal destinations require an approved anchor and no URL." });
    }
    if (value.destinationType === "NONE" && (value.destinationUrl || value.internalAnchor)) {
      context.addIssue({ code: "custom", path: ["destinationType"], message: "A NONE destination cannot include a URL or anchor." });
    }
    if (value.status === "PUBLISHED" && !value.publishedAt) {
      context.addIssue({ code: "custom", path: ["publishedAt"], message: "Published links require a publication timestamp." });
    }
    if (value.status === "DRAFT" && value.publishedAt) {
      context.addIssue({ code: "custom", path: ["publishedAt"], message: "Draft links cannot have a publication timestamp." });
    }
  });

export const publicationTransitionSchema = z
  .object({
    from: publicationStatusSchema,
    to: publicationStatusSchema,
  })
  .strict()
  .refine(({ from, to }) => {
    if (from === to) return true;
    if (from === "DRAFT") return to === "PUBLISHED" || to === "ARCHIVED";
    if (from === "PUBLISHED") return to === "DRAFT" || to === "ARCHIVED";
    return to === "DRAFT" || to === "PUBLISHED";
  }, "Unsupported publication state transition.");

export type LinkInput = z.infer<typeof linkSchema>;
