/**
 * Internal admin session contract.
 *
 * These values are exposed to the UI so components can greet the current
 * administrator and route to role-appropriate screens. Never expose `authVersion`,
 * the password hash, or other server-only fields through this DTO.
 */
export type AdminSession = {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN";
  isSuperAdmin: true;
};

/** Outcome of a guarded operation that may require reauthentication. */
export type AuthorizationResult<T> =
  | { ok: true; admin: AdminSession; data: T }
  | { ok: false; reason: "unauthenticated" | "unauthorized" | "inactive" | "service_error" };
