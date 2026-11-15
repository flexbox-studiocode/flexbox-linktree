/**
 * Vitest stubs for modules that only exist inside the Next.js server runtime.
 *
 * `server-only` throws when it is imported outside a React Server Component
 * environment, and `next/cache` requires an active `use cache` scope. Both are
 * no-ops under test so the real service module can be exercised directly.
 * This affects tests only; the application build still uses the real modules.
 */
export function cacheLife(): void {
  // No-op outside the Next.js cache scope.
}

export function cacheTag(): void {
  // No-op outside the Next.js cache scope.
}

export function revalidateTag(): void {
  // No-op outside the Next.js cache scope.
}

export function updateTag(): void {
  // No-op outside a Server Action scope.
}

export function revalidatePath(): void {
  // No-op outside the Next.js request scope.
}