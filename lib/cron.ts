/**
 * Authorising a scheduled request.
 *
 * **Why this is not just `header === secret`.** A cron endpoint is a public URL
 * — `/api/cron/*` sits outside `proxy.ts`'s `/family/:path*` matcher, so it has
 * no session in front of it and anyone who guesses the path can call it. The
 * bearer token is the only thing separating a scheduled run from a stranger's
 * GET, which makes a naive string compare the one place in this repo where the
 * comparison's *timing* is worth caring about: `===` on strings returns as soon
 * as two bytes differ, so the time it takes to say no leaks how much of the
 * prefix was right.
 *
 * The XOR-accumulate below always walks the whole string. It is deliberately
 * written without `node:crypto` so this module stays framework-free and
 * importable from anywhere (the `lib` zone has no server-only guard) and so the
 * unit tests need no Node built-ins.
 *
 * **Length is checked first and separately, and that is not a leak worth
 * fixing.** `timingSafeEqual` has the same property — it throws on a length
 * mismatch. Knowing the secret's length does not meaningfully help an attacker
 * who still has to find the bytes.
 */

/** Constant-time string equality. Both arguments are compared in full. */
function equalsInConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/**
 * Does this `Authorization` header carry the scheduler's secret?
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on every cron invocation
 * when that variable is set on the project. With no secret configured this
 * returns `false` for everything — a missing secret closes the endpoint rather
 * than opening it, because the alternative is an unauthenticated route that
 * looks configured and is not.
 */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization) return false;
  return equalsInConstantTime(authorization, `Bearer ${secret}`);
}
