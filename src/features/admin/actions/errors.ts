import "server-only";

import { AdminManagementError } from "@/features/admin/services/admin-management";
import { ContentAdminError } from "@/features/content/services/admin-content";
import { MediaAdminError } from "@/features/media/service";
import { AuthorizationError } from "@/features/auth/services/authorization";
import type { AdminFormState } from "@/features/admin/actions/form-state";

/**
 * Maps service-layer failures to safe form messages.
 *
 * Unknown errors are logged by name only and reported generically, so a stack
 * trace, SQL fragment, or storage credential never reaches the browser.
 */

export function adminContentErrorState(error: unknown, fallback: string): AdminFormState {
  if (error instanceof AuthorizationError) {
    return { status: "error", message: "Sesi tidak lagi berwenang. Masuk ulang." };
  }

  if (error instanceof ContentAdminError) {
    return { status: "error", message: error.message };
  }

  if (error instanceof MediaAdminError) {
    return { status: "error", message: error.message };
  }

  if (error instanceof AdminManagementError) {
    return { status: "error", message: error.message };
  }

  console.error(`[admin] action failed (${error instanceof Error ? error.name : "UnknownError"})`);

  return { status: "error", message: fallback };
}