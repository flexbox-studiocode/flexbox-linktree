import { z } from "zod";

import { isAllowedDestinationUrl } from "@/lib/utils/url";

export const approvedInternalAnchors = ["#atas", "#direktori", "#kontak"] as const;

export const destinationTypeSchema = z.enum(["EXTERNAL", "INTERNAL", "NONE"]);

const externalDestinationSchema = z
  .object({
    destinationType: z.literal("EXTERNAL"),
    destinationUrl: z
      .string()
      .trim()
      .min(1)
      .max(2_048)
      .refine(isAllowedDestinationUrl, "Use a valid HTTP(S) or mailto URL."),
    internalAnchor: z.null().optional(),
  })
  .strict();

const internalDestinationSchema = z
  .object({
    destinationType: z.literal("INTERNAL"),
    destinationUrl: z.null().optional(),
    internalAnchor: z.enum(approvedInternalAnchors),
  })
  .strict();

const noDestinationSchema = z
  .object({
    destinationType: z.literal("NONE"),
    destinationUrl: z.null().optional(),
    internalAnchor: z.null().optional(),
  })
  .strict();

/** Enforces a deliberate destination state rather than treating a missing URL as valid. */
export const destinationSchema = z.discriminatedUnion("destinationType", [
  externalDestinationSchema,
  internalDestinationSchema,
  noDestinationSchema,
]);
