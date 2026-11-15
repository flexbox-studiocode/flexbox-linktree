import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  parseSiteSetting,
  siteSettingSchemas,
  type SiteSettingKey,
} from "@/features/content/schemas/site-setting";
import { buildSettingsFormValues, type SettingsFormValues } from "@/features/content/settings-form";
import { findAdminSettings } from "@/features/content/repositories/admin-content";
import { invalidatePublicContent, type ActorContext, ContentAdminError } from "@/features/content/services/admin-content";
import { recordSecurityEvent } from "@/features/auth/services/security-event";

/**
 * Website settings persistence.
 *
 * Each write validates the whole key against its typed Zod schema before it
 * reaches the database, so no arbitrary JSON document can be stored. A key that
 * is missing or invalid falls back to the approved public copy when read back.
 */

export async function getSettingsForAdmin(): Promise<SettingsFormValues> {
  const rows = await findAdminSettings();
  const stored: Record<string, unknown> = {};

  for (const row of rows) {
    stored[row.key] = row.value;
  }

  return buildSettingsFormValues(stored);
}

export async function updateSiteSetting(input: {
  actor: ActorContext;
  key: SiteSettingKey;
  value: unknown;
}) {
  if (!(input.key in siteSettingSchemas)) {
    throw new ContentAdminError("invalid_input", "Kunci pengaturan tidak dikenal.");
  }

  let parsedValue;

  try {
    parsedValue = parseSiteSetting(input.key, input.value);
  } catch {
    throw new ContentAdminError("invalid_input", "Nilai pengaturan tidak valid.");
  }

  const changedFields = Object.keys(parsedValue as Record<string, unknown>).join(",");

  await prisma.siteSetting.upsert({
    where: { key: input.key },
    create: { key: input.key, value: parsedValue as Prisma.InputJsonValue },
    update: { value: parsedValue as Prisma.InputJsonValue },
  });

  await recordSecurityEvent({
    eventType: "SETTINGS_UPDATED",
    adminUserId: input.actor.adminId,
    targetType: "site_setting",
    targetId: input.key,
    metadata: {
      actorEmail: input.actor.actorEmail,
      settingKey: input.key,
      changedFields,
    },
  });

  invalidatePublicContent();

  return { key: input.key };
}
