import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Flexbox Linktree",
  description: "Flexbox Studio digital directory.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Final public locale and copy are confirmed in Phase 2.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}