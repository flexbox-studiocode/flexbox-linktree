/**
 * Form-state contract shared by the CMS Server Actions.
 *
 * Kept outside the `"use server"` modules because those may only export async
 * functions. `createdId` lets a create action report the new row so the form can
 * link to its edit screen without a second query.
 */
export type AdminFormState = {
  status: "idle" | "success" | "error";
  message: string;
  createdId?: string;
  /** Raw invitation token, returned exactly once to the issuing Super Admin. */
  token?: string;
};

export const ADMIN_IDLE_STATE: AdminFormState = { status: "idle", message: "" };

export function successState(message: string, extra?: Omit<AdminFormState, "status" | "message">): AdminFormState {
  return { status: "success", message, ...extra };
}

export function errorState(message: string): AdminFormState {
  return { status: "error", message };
}