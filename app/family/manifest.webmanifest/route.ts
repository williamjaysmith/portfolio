import type { MetadataRoute } from "next";
import { NextResponse } from "next/server";

// Web app manifest for the /family PWA (research R9, D8).
// This is an ordinary route handler rather than the `manifest.ts` file convention because Next
// only recognises that convention at the app root; a root manifest would be linked from every
// portfolio page. app/family/layout.tsx links it via `metadata.manifest`, and proxy.ts treats the
// path as public (D9) so an installed app can fetch it without a session.
export const dynamic = "force-static";

// D28 / FR-041: landscape-first. iPadOS ignores `orientation` — recorded as a spec assumption.
const manifest: MetadataRoute.Manifest = {
  name: "Family Calendar",
  short_name: "Family",
  id: "/family/",
  start_url: "/family/calendar",
  scope: "/family/",
  display: "standalone",
  orientation: "landscape-primary",
  background_color: "#FFFFFF",
  theme_color: "#FFFFFF",
  icons: [
    { src: "/family/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/family/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    {
      src: "/family/icons/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

export async function GET() {
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
