import { describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "../cron";

/**
 * The guard on `/api/cron/keep-alive`, which is a public URL — it sits outside
 * `proxy.ts`'s `/family/:path*` matcher, so this comparison is the only thing
 * between the scheduler and a stranger.
 */

const SECRET = "s3cret-value";
const VALID = `Bearer ${SECRET}`;

describe("isAuthorizedCronRequest", () => {
  it("accepts the scheduler's own header", () => {
    expect(isAuthorizedCronRequest(VALID, SECRET)).toBe(true);
  });

  it("rejects a wrong secret of the same length", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret-vaLue", SECRET)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
  });

  /**
   * **A missing secret closes the door, it does not open it.** The tempting
   * implementation — "no secret configured, so skip the check" — turns a
   * misconfigured deploy into an endpoint anyone can call, and it fails
   * silently because the happy path still returns 200.
   */
  it("rejects everything when no secret is configured", () => {
    expect(isAuthorizedCronRequest(VALID, undefined)).toBe(false);
    expect(isAuthorizedCronRequest(VALID, "")).toBe(false);
    expect(isAuthorizedCronRequest(null, undefined)).toBe(false);
  });

  it("requires the Bearer scheme, not the bare secret", () => {
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
  });

  it("is not fooled by a correct prefix", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}extra`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer s3cret", SECRET)).toBe(false);
  });

  it("is case-sensitive in both the scheme and the secret", () => {
    expect(isAuthorizedCronRequest(`bearer ${SECRET}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET.toUpperCase()}`, SECRET)).toBe(false);
  });

  it("does not treat whitespace as equivalent", () => {
    expect(isAuthorizedCronRequest(`Bearer  ${SECRET}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`${VALID} `, SECRET)).toBe(false);
  });
});
