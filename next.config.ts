import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  compress: true,

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react', 'react-icons'],
    // /family avatar uploads: a ≤5 MB image plus multipart overhead (D16).
    serverActions: { bodySizeLimit: "6mb" },

    /**
     * How long the client router may reuse a route it already fetched.
     *
     * **`dynamic` defaults to 0**, and every `/family` route is dynamic — so
     * before this, tapping back to a tab you were just on cost a FULL server
     * round trip, every time. Measured against production: Tasks took 696ms on
     * first visit and 351ms on the second, when the second should have been free.
     * That is the complaint — "it feels very slow when I click tabs" — and it is
     * a one-line cause.
     *
     * 30 seconds, chosen to match `STALE_TIME` in `lib/family/queries.ts` rather
     * than picked for feel: the RSC payload carries the server-seeded
     * `initialData` for those same queries, so the two now go stale together
     * instead of disagreeing. Nothing goes unrefreshed for longer than it did —
     * the client queries revalidate on mount and Realtime invalidates them on
     * any change, and `initialData` only ever fills a query that has none.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
