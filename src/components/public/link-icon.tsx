import type { PublicLinkIcon as LinkIconName } from "@/features/content/types/public-content";

const ICON_PATHS: Record<LinkIconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.7 6.8L20.5 11.5l-6.8 1.7L12 20l-1.7-6.8L3.5 11.5l6.8-1.7L12 3Z" />
      <path d="m18.5 17 .5 2 .5-2 2-.5-2-.5-.5-2-.5 2-2 .5 2 .5Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.3 2.6 3.4 5.6 3.4 9s-1.1 6.4-3.4 9c-2.3-2.6-3.4-5.6-3.4-9s1.1-6.4 3.4-9Z" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.8A2.8 2.8 0 0 1 6.8 2H20v16.5H6.8A2.8 2.8 0 0 0 4 21.3V4.8Z" />
      <path d="M4 19a2.8 2.8 0 0 1 2.8-2.5H20" />
      <path d="M8.5 6h7M8.5 9.5h5" />
    </>
  ),
  shape: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4.5 8.2 7.5 4.3 7.5-4.3M12 12.5V21" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c.4-3.4 2.6-5.2 6-5.2s5.6 1.8 6 5.2" />
      <path d="M16 5.4a3 3 0 0 1 0 5.6M17.6 14.6c2.1.5 3.3 2.1 3.6 4.4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="m4.2 7.4 7.8 5.6 7.8-5.6" />
    </>
  ),
};

/**
 * Decorative category icon. Hidden from assistive technology because the card
 * title already names the destination.
 */
export default function LinkIcon({
  name,
  className,
}: {
  name: LinkIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}