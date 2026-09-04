/**
 * The household door (FR-002, FR-004).
 *
 * One shared Supabase account, so the only thing anybody types is a password
 * and Supabase is the only thing that judges it. What is worth pinning down
 * here is what the door gives away: the account address must never leave the
 * server, every failure must sound identical, and nothing that was typed may
 * come back into the document.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Stands in for the NEXT_REDIRECT signal `redirect()` throws in the framework. */
class RedirectSignal extends Error {
  readonly digest = "NEXT_REDIRECT";

  constructor(readonly to: string) {
    super(`NEXT_REDIRECT;${to}`);
    this.name = "RedirectSignal";
  }
}

// Fixtures. Obviously fake: this file must never carry a real credential.
const ACCOUNT_EMAIL = "household@example.test";
const TYPED_PASSWORD = "hunter-two-but-longer";
const HOME = "/family/calendar";
const GENERIC_FAILURE = "That password isn't right.";
const PASSWORD_LABEL = "Household password";

const signInWithPassword = vi.fn();
const getClaims = vi.fn();
const rpc = vi.fn();
const clearActor = vi.fn();
const redirectMock = vi.fn((to: string): never => {
  throw new RedirectSignal(to);
});

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/family/actor", () => ({
  clearActor: () => clearActor(),
  readActor: async () => null,
}));
vi.mock("@/lib/family/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims, signInWithPassword, signOut: vi.fn() },
    schema: () => ({ rpc }),
  }),
}));

const { signIn } = await import("@/lib/family/actions/auth");
const { SignInForm } = await import("@/app/family/(auth)/sign-in/SignInForm");
const { default: SignInPage } = await import("@/app/family/(auth)/sign-in/page");

function formWith(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(entries)) form.append(name, value);
  return form;
}

/** `getClaims` + `my_household` as they answer for somebody on the allowlist. */
function signedInAsMember(): void {
  getClaims.mockResolvedValue({
    data: { claims: { sub: "user-1", email: ACCOUNT_EMAIL } },
    error: null,
  });
  rpc.mockResolvedValue({ data: "household-1", error: null });
}

function signedOut(): void {
  getClaims.mockResolvedValue({ data: null, error: null });
  rpc.mockResolvedValue({ data: null, error: null });
}

/** Everything the caller is allowed to see after a failed sign-in. */
function visibleResult(result: unknown): string {
  return JSON.stringify(result);
}

beforeEach(() => {
  vi.stubEnv("FAMILY_ACCOUNT_EMAIL", ACCOUNT_EMAIL);
  signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null });
  getClaims.mockReset();
  rpc.mockReset();
  clearActor.mockReset();
  redirectMock.mockClear();
  signedOut();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signIn", () => {
  it("pairs the typed password with the address the browser never sees", async () => {
    await expect(signIn(null, formWith({ password: TYPED_PASSWORD }))).rejects.toBeInstanceOf(
      RedirectSignal,
    );

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: ACCOUNT_EMAIL,
      password: TYPED_PASSWORD,
    });
    expect(redirectMock).toHaveBeenCalledWith(HOME);
  });

  // A stale punch-in must not be inherited by whoever just opened the door.
  it("punches the previous actor out when a new session begins", async () => {
    await expect(signIn(null, formWith({ password: TYPED_PASSWORD }))).rejects.toBeInstanceOf(
      RedirectSignal,
    );

    expect(clearActor).toHaveBeenCalled();
  });

  // The address is configuration, not input. A crafted POST that carries its
  // own `email` field must not aim the sign-in at some other account.
  it("ignores an account address supplied by the caller", async () => {
    await expect(
      signIn(null, formWith({ email: "attacker@example.test", password: TYPED_PASSWORD })),
    ).rejects.toBeInstanceOf(RedirectSignal);

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: ACCOUNT_EMAIL,
      password: TYPED_PASSWORD,
    });
  });

  // The whole point of one shared account is that there is nothing to probe
  // for. Distinguishing these would hand a stranger the account's existence.
  it.each([
    ["a wrong password", "Invalid login credentials"],
    ["an account that does not exist", "User not found"],
    ["an unconfirmed account", "Email not confirmed"],
    ["a rate limit", "Request rate limit reached"],
  ])("says exactly the same thing for %s", async (_label, supabaseMessage) => {
    signInWithPassword.mockResolvedValue({ data: null, error: { message: supabaseMessage } });

    const result = await signIn(null, formWith({ password: TYPED_PASSWORD }));

    expect(result).toEqual({
      ok: false,
      error: "NOT_AUTHENTICATED",
      message: GENERIC_FAILURE,
    });
    expect(visibleResult(result)).not.toContain(supabaseMessage);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("never returns the password or the account address", async () => {
    signInWithPassword.mockResolvedValue({ data: null, error: { message: "Invalid login credentials" } });

    const result = await signIn(null, formWith({ password: TYPED_PASSWORD }));

    expect(visibleResult(result)).not.toContain(TYPED_PASSWORD);
    expect(visibleResult(result)).not.toContain(ACCOUNT_EMAIL);
  });

  it("refuses an empty password without spending a Supabase attempt", async () => {
    const result = await signIn(null, formWith({ password: "" }));

    expect(result).toMatchObject({ ok: false, message: GENERIC_FAILURE });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  // A missing FAMILY_ACCOUNT_EMAIL is an operator mistake, not a wrong
  // password — it must not read as one, and it must not sign anybody in.
  it("reports an unreachable back end rather than a bad password", async () => {
    vi.stubEnv("FAMILY_ACCOUNT_EMAIL", "");

    const result = await signIn(null, formWith({ password: TYPED_PASSWORD }));

    expect(result).toMatchObject({ ok: false, error: "UNAVAILABLE" });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("SignInForm", () => {
  it("asks for a password and nothing else", () => {
    const { container } = render(<SignInForm />);

    const inputs = container.querySelectorAll("input");
    expect(inputs).toHaveLength(1);

    const password = screen.getByLabelText(PASSWORD_LABEL);
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("offers no identity provider and no address field", () => {
    render(<SignInForm />);

    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/e-?mail/i)).not.toBeInTheDocument();
  });

  it("surfaces one unhelpful message and keeps the password out of the document", async () => {
    signInWithPassword.mockResolvedValue({ data: null, error: { message: "Invalid login credentials" } });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText(PASSWORD_LABEL), TYPED_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(GENERIC_FAILURE)).toBeInTheDocument();
    // Nothing about the account, and nothing Supabase said in its own words.
    expect(document.body.textContent).not.toContain(ACCOUNT_EMAIL);
    expect(document.body.textContent).not.toContain("Invalid login credentials");
    // Not echoed back as markup, and not left sitting in the field either.
    expect(document.body.innerHTML).not.toContain(TYPED_PASSWORD);
    expect(screen.getByLabelText(PASSWORD_LABEL)).toHaveValue("");
  });
});

describe("SignInPage", () => {
  it("sends somebody who is already a member straight to the calendar", async () => {
    signedInAsMember();

    await expect(SignInPage()).rejects.toBeInstanceOf(RedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith(HOME);
  });

  it("shows the password form to a visitor with no session", async () => {
    render(await SignInPage());

    expect(screen.getByRole("heading", { name: "Family calendar" })).toBeInTheDocument();
    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeInTheDocument();
    expect(screen.getByText("Only household accounts can sign in.")).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
