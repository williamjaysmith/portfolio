/**
 * @vitest-environment node
 *
 * `proxy.ts` runs in the Next request pipeline, not a browser: `NextRequest`
 * and `NextResponse` are built on the undici globals that exist in the node
 * realm, so this file runs there rather than under jsdom.
 *
 * It lives in `app/family/__tests__/` because the root `proxy.ts` sits in
 * fallow's `config` zone, which only the unrestricted test directories may
 * import.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/family/supabase/proxy";
import { config, proxy } from "@/proxy";

vi.mock("@/lib/family/supabase/proxy", () => ({
  updateSession: vi.fn(),
}));

const ORIGIN = "http://localhost:3000";
const SIGN_IN = `${ORIGIN}/family/sign-in`;

/** Paths that must reach a Server Component only with a session (D9). */
const PROTECTED_PATHS = [
  "/family",
  "/family/",
  "/family/calendar",
  "/family/settings",
  "/family/tasks/today",
];

/**
 * Paths the sign-in flow and the installed PWA fetch while signed out. A
 * redirect on any of these breaks sign-in or silently swaps an icon/manifest
 * for an HTML 307 (D9).
 */
const PUBLIC_PATHS = [
  "/family/sign-in",
  "/family/auth/callback",
  "/family/not-authorized",
  "/family/manifest.webmanifest",
  "/family/icons/icon-192.png",
  "/family/avatars/fox.svg",
  "/family/apple-icon.png",
];

interface SessionStub {
  isAuthenticated: boolean;
  cookies?: readonly { name: string; value: string }[];
  headers?: Readonly<Record<string, string>>;
}

/** Drive `updateSession`'s contract: a response to pass through, plus a verdict. */
function stubSession({ isAuthenticated, cookies = [], headers = {} }: SessionStub): void {
  vi.mocked(updateSession).mockImplementation(async (request: NextRequest) => {
    const response = NextResponse.next({ request });
    for (const { name, value } of cookies) {
      response.cookies.set(name, value, { path: "/", httpOnly: true, sameSite: "lax" });
    }
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return { response, isAuthenticated };
  });
}

function requestFor(pathname: string): NextRequest {
  return new NextRequest(new URL(`${ORIGIN}${pathname}`));
}

function isRedirectToSignIn(response: NextResponse): boolean {
  return response.status === 307 && response.headers.get("location") === SIGN_IN;
}

describe("proxy", () => {
  beforeEach(() => {
    vi.mocked(updateSession).mockReset();
  });

  describe("signed out", () => {
    beforeEach(() => {
      stubSession({ isAuthenticated: false });
    });

    it.each(PROTECTED_PATHS)("redirects %s to the sign-in page", async (pathname) => {
      const response = await proxy(requestFor(pathname));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(SIGN_IN);
    });

    it.each(PUBLIC_PATHS)("serves %s without a redirect", async (pathname) => {
      const response = await proxy(requestFor(pathname));

      expect(response.headers.get("location")).toBeNull();
      expect(response.status).toBe(200);
    });

    it("redirects to the requested origin, never an attacker-supplied one", async () => {
      const request = new NextRequest(new URL("https://willsmith.dev/family/calendar"));

      const response = await proxy(request);

      expect(response.headers.get("location")).toBe("https://willsmith.dev/family/sign-in");
    });

    // The public list is prefix-scoped (`route` or `route/…`). A path that
    // merely starts with the same characters is a different route and must
    // still be gated.
    it.each(["/family/auth-notes", "/family/icons-backup", "/family/sign-in-links"])(
      "does not treat %s as public",
      async (pathname) => {
        expect(isRedirectToSignIn(await proxy(requestFor(pathname)))).toBe(true);
      },
    );
  });

  describe("signed in", () => {
    beforeEach(() => {
      stubSession({ isAuthenticated: true });
    });

    it.each([...PROTECTED_PATHS, ...PUBLIC_PATHS])("never redirects %s", async (pathname) => {
      const response = await proxy(requestFor(pathname));

      expect(response.headers.get("location")).toBeNull();
      expect(response.status).toBe(200);
    });
  });

  // FR-007 / D26: nothing under /family may be indexed, and the redirect is a
  // /family response too.
  describe("X-Robots-Tag (FR-007)", () => {
    it.each([
      ["a signed-out protected path (redirect)", false, "/family/calendar"],
      ["a signed-out public path", false, "/family/sign-in"],
      ["a signed-in protected path", true, "/family/settings"],
      ["a static PWA asset", false, "/family/icons/icon-192.png"],
    ])("is set on %s", async (_label, isAuthenticated, pathname) => {
      stubSession({ isAuthenticated });

      const response = await proxy(requestFor(pathname));

      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });
  });

  describe("session refresh on a redirect", () => {
    // Supabase refresh tokens are single-use. If the refreshed cookie is left
    // on the discarded response, the token that was just spent never reaches
    // the browser and the tablet is signed out on the next request.
    it("carries the refreshed auth cookies onto the redirect", async () => {
      stubSession({
        isAuthenticated: false,
        cookies: [
          { name: "sb-localhost-auth-token", value: "refreshed-access" },
          { name: "sb-localhost-auth-token.1", value: "refreshed-chunk" },
        ],
      });

      const response = await proxy(requestFor("/family/calendar"));

      expect(isRedirectToSignIn(response)).toBe(true);
      expect(response.cookies.get("sb-localhost-auth-token")?.value).toBe("refreshed-access");
      expect(response.cookies.get("sb-localhost-auth-token.1")?.value).toBe("refreshed-chunk");
    });

    it("keeps the cookie attributes that scope and protect the session", async () => {
      stubSession({
        isAuthenticated: false,
        cookies: [{ name: "sb-localhost-auth-token", value: "refreshed-access" }],
      });

      const response = await proxy(requestFor("/family/calendar"));
      const cookie = response.cookies.get("sb-localhost-auth-token");

      expect(cookie).toMatchObject({ path: "/", httpOnly: true, sameSite: "lax" });
    });

    // @supabase/ssr sets these alongside the refreshed cookies precisely so no
    // shared cache stores a response carrying somebody's session.
    it("carries the no-store headers onto the redirect", async () => {
      stubSession({
        isAuthenticated: false,
        cookies: [{ name: "sb-localhost-auth-token", value: "refreshed-access" }],
        headers: {
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
          Expires: "Thu, 01 Jan 1970 00:00:00 GMT",
          Pragma: "no-cache",
        },
      });

      const response = await proxy(requestFor("/family/calendar"));

      expect(response.headers.get("Cache-Control")).toBe(
        "private, no-cache, no-store, max-age=0, must-revalidate",
      );
      expect(response.headers.get("Expires")).toBe("Thu, 01 Jan 1970 00:00:00 GMT");
      expect(response.headers.get("Pragma")).toBe("no-cache");
    });

    it("leaves unrelated headers off the redirect", async () => {
      stubSession({
        isAuthenticated: false,
        headers: { "X-Supabase-Debug": "leaked" },
      });

      const response = await proxy(requestFor("/family/calendar"));

      expect(response.headers.get("X-Supabase-Debug")).toBeNull();
    });
  });

  describe("config", () => {
    // Narrowing this drops session refresh on real routes; widening it makes
    // the proxy run on the portfolio, which has no Supabase session at all.
    it("intercepts /family and everything under it, and nothing else", () => {
      expect(config.matcher).toEqual(["/family/:path*"]);
    });
  });
});
