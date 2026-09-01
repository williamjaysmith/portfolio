import { ACTION_MESSAGES, type ActionError, type ActionResult } from "@/lib/family/errors";

/**
 * `ActionResult` builders for component tests.
 *
 * `lib/family/errors` keeps `ok` internal (only `runAction` mints successes in
 * production), so tests that stub an action build the shape here.
 */

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ActionError, message?: string): ActionResult<never> {
  return { ok: false, error, message: message ?? ACTION_MESSAGES[error] };
}
