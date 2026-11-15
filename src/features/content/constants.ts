/**
 * Approved public navigation anchors.
 *
 * This list is the single source of truth for internal link destinations:
 * the public page renders these anchors, and the link validation schema only
 * accepts an internal destination that appears here.
 */
export const publicAnchors = {
  top: "#atas",
  directory: "#direktori",
  contact: "#kontak",
} as const;

export type PublicAnchor = (typeof publicAnchors)[keyof typeof publicAnchors];
