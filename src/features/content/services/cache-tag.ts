/**
 * Cache tag shared by the public content service and the CMS mutations.
 *
 * The public page caches categories and site settings under this tag. CMS
 * mutations call `updateTag(publicContentCacheTag)` after a successful commit,
 * so a saved change becomes visible on the next request without waiting for the
 * one-minute `cacheLife` window.
 */
export const publicContentCacheTag = "public-content";
