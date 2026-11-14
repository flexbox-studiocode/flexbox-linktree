import type { Metadata, Viewport } from "next";
import { Anton, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * Typography per `.docs/Desain.md`:
 * - Anton for the display headline (approved).
 * - Manrope for body/navigation/cards (approved fallback until the licensed
 *   Satoshi assets are available; Satoshi is not redistributed here).
 * Both are self-hosted at build time through `next/font`, which avoids
 * third-party runtime requests and layout shift.
 */
const display = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: "Flexbox Studio — Digital Hub",
    template: "%s · Flexbox Studio",
  },
  description:
    "Direktori digital Flexbox Studio: produk, proyek, sumber daya, komunitas, dan kontak dalam satu tempat.",
  applicationName: "Flexbox Studio Digital Hub",
  robots: {
    index: true,
    follow: true,
  },
  // Open Graph image and canonical URL stay unset until a verified production
  // domain and approved sharing artwork exist.
  openGraph: {
    type: "website",
    siteName: "Flexbox Studio",
    title: "Flexbox Studio — Digital Hub",
    description:
      "Direktori digital Flexbox Studio: produk, proyek, sumber daya, komunitas, dan kontak dalam satu tempat.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flexbox Studio — Digital Hub",
    description:
      "Direktori digital Flexbox Studio dalam satu halaman.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f9fc",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${display.variable} ${body.variable}`} lang="id">
      <body>{children}</body>
    </html>
  );
}