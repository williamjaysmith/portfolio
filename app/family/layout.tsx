import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import type { ReactNode } from "react";

import "./tokens.css";

// Stand-ins for the (unknown) Skylight device typefaces — research R12. Both are variable fonts,
// so `weight` is omitted and the full wght axis ships. The `.variable` classes are applied to the
// SAME element as `.family` so --font-fraunces / --font-dm-sans resolve inside tokens.css.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  axes: ["opsz"],
});

// Shallow-merged over the root layout's metadata for every /family/* route (title, robots,
// manifest, icons win here; the root's openGraph/twitter stay). FR-007: never indexed —
// proxy.ts adds the matching X-Robots-Tag header (D26). The manifest is an ordinary route
// handler because the `manifest` file convention is root-only (D8).
export const metadata: Metadata = {
  title: { default: "Family", template: "%s · Family" },
  robots: { index: false, follow: false },
  manifest: "/family/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Family", statusBarStyle: "default" },
  // `appleWebApp.capable` only emits `mobile-web-app-capable`; iOS still reads the Apple-prefixed tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: { apple: "/family/icons/apple-touch-icon.png" },
};

// themeColor / viewportFit live on `viewport`, not `metadata` (Next ≥ 14). `cover` lets the
// shell paint under the notch / home indicator; components respect env(safe-area-inset-*).
export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

// Nested layout: the root layout owns <html>/<body>, so the family scope is a wrapper <div>.
export default function FamilyLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className={`family ${fraunces.variable} ${dmSans.variable} min-h-dvh`}>
      {children}
    </div>
  );
}
