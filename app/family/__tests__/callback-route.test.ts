/**
 * @vitest-environment node
 *
 * The OAuth callback is the only place a session comes into being, and the only
 * place the allowlist is enforced at sign-in (FR-003). It runs in the Next
 * request pipeline, so it needs the node realm rather than jsdom.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();
const clearActor = vi.fn();

vi.mock("@/lib/family/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession, signOut },
    schema: () => ({ rpc }),
  }),
}));
vi.mock("@/lib/family/actor", () => ({ clearActor: () => clearActor() }));

const { GET } = await import("@/app/family/(auth)/auth/callback/route");

const ORIGIN = "http://localhost:3000";

function callback(query: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(`${ORIGIN}/family/auth/callback${query}`), { headers });
}

describe("auth callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
    signOut.mockReset().mockResolvedValue({});
    rpc.mockReset().mockResolvedValue({ data: "household-1", error: null });
    clearActor.mockReset();
  });

  it("lands an allowlisted account on the calendar", async () => {
    const res = await GET(callback("?code=abc"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/calendar`);
  });

  it("signs out an account that is not on the allowlist and never shows it the app", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const res = await GET(callback("?code=abc"));

    expect(signOut).toHaveBeenCalled();
    expect(clearActor).toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/not-authorized`);
  });

  it("treats a failed membership claim as a refusal, not a welcome", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await GET(callback("?code=abc"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/not-authorized`);
  });

  it("sends a provider error to not-authorized without exchanging anything", async () => {
    const res = await GET(callback("?error=access_denied"));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/not-authorized`);
  });

  it("sends a request with no code back to sign-in", async () => {
    const res = await GET(callback(""));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/sign-in`);
  });

  it("reports a failed code exchange on the sign-in page", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });
    const res = await GET(callback("?code=abc"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/sign-in?error=oauth`);
  });

  it("ignores a `next` parameter — an auth callback is not a redirector", async () => {
    const res = await GET(callback("?code=abc&next=https://evil.example/steal"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/calendar`);
  });

  it("ignores a forged x-forwarded-host, so the session cannot be aimed elsewhere", async () => {
    const res = await GET(callback("?code=abc", { "x-forwarded-host": "evil.example" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/calendar`);
  });

  it("honours a forwarded host that matches the request's own host", async () => {
    const res = await GET(callback("?code=abc", { "x-forwarded-host": "localhost:3000" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/family/calendar`);
  });
});
