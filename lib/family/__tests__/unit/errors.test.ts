import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ACTION_MESSAGES,
  ActionFailure,
  type ActionError,
  fail,
  runAction,
} from "@/lib/family/errors";

/**
 * `runAction` is the only thing standing between a server-side exception and
 * the browser: it must convert known failures into copy the UI can render,
 * reduce everything else to a safe UNAVAILABLE, and let Next's control-flow
 * throws (`redirect()` / `notFound()`) pass through untouched.
 */

/** Every code in the union — the runtime check below proves nothing is missing. */
const ALL_ERRORS: readonly ActionError[] = [
  "NOT_AUTHENTICATED",
  "NOT_A_MEMBER",
  "NO_ACTOR",
  "FORBIDDEN",
  "BAD_PIN",
  "PIN_LOCKED",
  "NO_PIN",
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "UNAVAILABLE",
];

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("runAction — success", () => {
  it("wraps the returned value", async () => {
    const category = { id: "abc", label: "Alex" };
    await expect(runAction(async () => category)).resolves.toEqual({ ok: true, data: category });
  });

  it("treats falsy data as success, not as a failure", async () => {
    await expect(runAction(async () => null)).resolves.toEqual({ ok: true, data: null });
    await expect(runAction(async () => false)).resolves.toEqual({ ok: true, data: false });
    await expect(runAction(async () => 0)).resolves.toEqual({ ok: true, data: 0 });
  });

  it("logs nothing on the happy path", async () => {
    await runAction(async () => "done");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("runAction — ActionFailure", () => {
  it("converts a thrown ActionFailure into its result shape", async () => {
    const result = await runAction(async () => {
      throw new ActionFailure("FORBIDDEN");
    });
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: ACTION_MESSAGES.FORBIDDEN,
    });
  });

  it("keeps a more specific message an action supplied", async () => {
    const result = await runAction(async () => {
      throw new ActionFailure("CONFLICT", "Alex is the only parent left.");
    });
    expect(result).toEqual({
      ok: false,
      error: "CONFLICT",
      message: "Alex is the only parent left.",
    });
  });

  it("carries fieldErrors through so a form can highlight the field", async () => {
    const result = await runAction(async () => {
      throw new ActionFailure("VALIDATION", undefined, { label: ["Name is too long"] });
    });
    expect(result).toEqual({
      ok: false,
      error: "VALIDATION",
      message: ACTION_MESSAGES.VALIDATION,
      fieldErrors: { label: ["Name is too long"] },
    });
  });

  it("omits fieldErrors entirely when there are none", async () => {
    const result = await runAction(async () => {
      throw new ActionFailure("NOT_FOUND");
    });
    expect(Object.hasOwn(result, "fieldErrors")).toBe(false);
  });

  it("does not log an expected failure as a server error", async () => {
    await runAction(async () => {
      throw new ActionFailure("BAD_PIN");
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("handles a rejected promise as well as a synchronous throw", async () => {
    const result = await runAction(() => Promise.reject(new ActionFailure("PIN_LOCKED")));
    expect(result).toEqual({
      ok: false,
      error: "PIN_LOCKED",
      message: ACTION_MESSAGES.PIN_LOCKED,
    });
  });
});

describe("runAction — unknown failures", () => {
  it("reduces an unexpected error to UNAVAILABLE without leaking its message", async () => {
    const secret = "postgres://admin:hunter2@10.0.0.5:5432/postgres";
    const result = await runAction(async () => {
      throw new Error(`connect ECONNREFUSED ${secret}`);
    });

    expect(result).toEqual({
      ok: false,
      error: "UNAVAILABLE",
      message: ACTION_MESSAGES.UNAVAILABLE,
    });

    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("hunter2");
    expect(serialised).not.toContain("10.0.0.5");
    expect(serialised).not.toContain("ECONNREFUSED");
  });

  it("never lets a stack trace reach the client", async () => {
    const result = await runAction(async () => {
      throw new Error("boom");
    });
    expect(JSON.stringify(result)).not.toContain("errors.test");
    expect(Object.keys(result).sort()).toEqual(["error", "message", "ok"]);
  });

  it("still logs the original error server-side so it is diagnosable", async () => {
    const original = new Error("relation \"family.categories\" does not exist");
    await runAction(async () => {
      throw original;
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toContain(original);
  });

  it("handles a thrown non-Error value", async () => {
    const fromString = await runAction(async () => {
      throw "kaboom";
    });
    const fromNothing = await runAction(async () => {
      throw undefined;
    });
    expect(fromString).toEqual({
      ok: false,
      error: "UNAVAILABLE",
      message: ACTION_MESSAGES.UNAVAILABLE,
    });
    expect(fromNothing).toEqual({
      ok: false,
      error: "UNAVAILABLE",
      message: ACTION_MESSAGES.UNAVAILABLE,
    });
  });
});

describe("runAction — Next.js control-flow signals", () => {
  it("re-throws a redirect signal untouched, so the redirect still happens", async () => {
    const signal = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/family/sign-in;307;",
    });
    await expect(
      runAction(async () => {
        throw signal;
      }),
    ).rejects.toBe(signal);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("re-throws a notFound signal, including as a plain object", async () => {
    const signal = { digest: "NEXT_NOT_FOUND" };
    await expect(
      runAction(async () => {
        throw signal;
      }),
    ).rejects.toBe(signal);
  });

  it("does not mistake a lookalike digest for a framework signal", async () => {
    const notASignal = await runAction(async () => {
      throw { digest: "REDIRECT;/somewhere" };
    });
    const numericDigest = await runAction(async () => {
      throw { digest: 1234567890 };
    });
    expect(notASignal).toEqual({
      ok: false,
      error: "UNAVAILABLE",
      message: ACTION_MESSAGES.UNAVAILABLE,
    });
    expect(numericDigest).toEqual({
      ok: false,
      error: "UNAVAILABLE",
      message: ACTION_MESSAGES.UNAVAILABLE,
    });
  });
});

describe("fail", () => {
  it("builds a failure result with the default copy for the code", () => {
    for (const code of ALL_ERRORS) {
      expect(fail(code)).toEqual({ ok: false, error: code, message: ACTION_MESSAGES[code] });
    }
  });

  it("accepts an override message and field errors", () => {
    expect(fail("VALIDATION", "Pick a colour", { color: ["Required"] })).toEqual({
      ok: false,
      error: "VALIDATION",
      message: "Pick a colour",
      fieldErrors: { color: ["Required"] },
    });
  });

  it("omits the fieldErrors key rather than setting it to undefined", () => {
    expect(Object.hasOwn(fail("NO_ACTOR"), "fieldErrors")).toBe(false);
  });
});

describe("ActionFailure", () => {
  it("is a real Error carrying its code and default copy", () => {
    const failure = new ActionFailure("NO_PIN");
    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe("ActionFailure");
    expect(failure.code).toBe("NO_PIN");
    expect(failure.message).toBe(ACTION_MESSAGES.NO_PIN);
    expect(failure.fieldErrors).toBeUndefined();
  });

  it("keeps an explicit message and field errors", () => {
    const failure = new ActionFailure("VALIDATION", "Four digits, please", { pin: ["Bad format"] });
    expect(failure.message).toBe("Four digits, please");
    expect(failure.fieldErrors).toEqual({ pin: ["Bad format"] });
  });
});

describe("ACTION_MESSAGES", () => {
  it("has copy for every error code and nothing else", () => {
    expect(Object.keys(ACTION_MESSAGES).sort()).toEqual([...ALL_ERRORS].sort());
    for (const code of ALL_ERRORS) {
      expect(ACTION_MESSAGES[code].trim().length).toBeGreaterThan(0);
    }
  });

  it("says something different for each code, so the UI is never ambiguous", () => {
    expect(new Set(Object.values(ACTION_MESSAGES)).size).toBe(ALL_ERRORS.length);
  });

  it("reads as user-facing copy, not as a machine code or a leaked object", () => {
    for (const code of ALL_ERRORS) {
      const message = ACTION_MESSAGES[code];
      expect(message).not.toContain(code);
      expect(message).not.toMatch(/undefined|\[object |Error:|SQLSTATE/);
    }
  });
});
