/*
 * The contact destination is intentionally not published yet.
 *
 * `.docs/Desain.md` forbids inventing an email address or contact URL, and the
 * owner has not confirmed the real Flexbox contact channel. While
 * `contactEmail` is `null`, the public contact section renders a status label
 * instead of a fake `mailto:` link. Set it to the verified address to enable
 * the contact call-to-action.
 *
 * Verification checklist before enabling:
 * - The mailbox exists and is monitored by Flexbox Studio.
 * - The address is approved for public display in the PRD's open-decisions list.
 */
export const contactEmail: string | null = null;
