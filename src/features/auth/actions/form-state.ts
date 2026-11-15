/**
 * Shared form-state contract for the account security Server Actions.
 *
 * Kept outside the `"use server"` modules because those may only export async
 * functions.
 */
export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const IDLE_STATE: FormState = { status: "idle", message: "" };