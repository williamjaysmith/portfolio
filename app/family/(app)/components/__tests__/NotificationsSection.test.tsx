/**
 * 008 T020/T022: the household's reminder choices (FR-802–FR-807).
 *
 * Two groups, exactly four choices, the lead time's presets and its custom unit
 * picker, a member finding it read-only, and the one plain sentence telling the
 * household where a reminder will actually appear — which is a product
 * statement, not a footnote (spec Assumption 15).
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { ActionResult } from "@/lib/family/errors";
import type { Household, HouseholdSettings, HouseholdSettingsPatch } from "@/lib/family/types";
import { settingsPatchSchema } from "@/lib/family/validation";

import { ok } from "./action-result";
import { makeActor, makeContext, makeHousehold, makeSettings, withFamily } from "./family-test-utils";

type SettingsResult = ActionResult<{ household: Household; settings: HouseholdSettings }>;

const updateHouseholdSettings =
  vi.fn<(patch: HouseholdSettingsPatch) => Promise<SettingsResult>>();

vi.mock("@/lib/family/actions/settings", () => ({
  updateHouseholdSettings: (patch: HouseholdSettingsPatch) => updateHouseholdSettings(patch),
}));

const { NotificationsSection } = await import("../settings/NotificationsSection");
const { resetReminderSwitches } = await import("../notifications/reminderSwitches");

const household = makeHousehold();

function renderWith(settings: HouseholdSettings, role: "parent" | "member" = "parent") {
  const context = makeContext({ household, settings, actor: makeActor(role) });
  return render(withFamily(context, <NotificationsSection />));
}

function lastPatch(): HouseholdSettingsPatch {
  const call = updateHouseholdSettings.mock.calls.at(-1);
  if (!call) throw new Error("the action was never called");
  return call[0];
}

async function save(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(updateHouseholdSettings).toHaveBeenCalled());
}

beforeEach(() => {
  // The device switch store is module-level, so one test flipping the chime
  // would otherwise be visible to the next.
  resetReminderSwitches();
  updateHouseholdSettings.mockReset();
  updateHouseholdSettings.mockResolvedValue(
    ok({ household, settings: makeSettings() }) as SettingsResult,
  );
});

describe("the four choices, in two groups", () => {
  it("offers exactly the reference's four, and nothing else", () => {
    renderWith(makeSettings());

    const calendar = screen.getByRole("group", { name: "Calendar" });
    const tasks = screen.getByRole("group", { name: "Tasks" });

    expect(within(calendar).getAllByRole("switch").map((s) => s.getAttribute("aria-label") ?? s.parentElement?.textContent?.trim())).toEqual([
      "At time of event",
      "Before event",
    ]);
    expect(within(tasks).getAllByRole("switch")).toHaveLength(2);
    for (const name of ["At time of event", "Before event", "When Due", "When Completed"]) {
      expect(screen.getByRole("switch", { name })).toBeTruthy();
    }
  });

  it("groups them as Calendar and Tasks", () => {
    renderWith(makeSettings());
    const calendar = screen.getByRole("group", { name: "Calendar" });
    const tasks = screen.getByRole("group", { name: "Tasks" });

    expect(within(calendar).getByRole("switch", { name: "At time of event" })).toBeTruthy();
    expect(within(tasks).getByRole("switch", { name: "When Due" })).toBeTruthy();
  });

  it("shows a fresh household FR-807's defaults", () => {
    renderWith(makeSettings());

    expect(screen.getByRole("switch", { name: "At time of event" })).toHaveProperty(
      "checked",
      false,
    );
    expect(screen.getByRole("switch", { name: "Before event" })).toHaveProperty("checked", true);
    expect(screen.getByRole("switch", { name: "When Due" })).toHaveProperty("checked", true);
    expect(screen.getByRole("switch", { name: "When Completed" })).toHaveProperty("checked", false);
    expect(screen.getByRole("combobox", { name: "Before event" })).toHaveProperty("value", "10");
  });

  it("sends every choice the household made", async () => {
    renderWith(makeSettings());

    fireEvent.click(screen.getByRole("switch", { name: "At time of event" }));
    fireEvent.click(screen.getByRole("switch", { name: "When Completed" }));
    await save();

    expect(lastPatch()).toMatchObject({
      notifyEventAtTime: true,
      notifyEventBefore: true,
      notifyEventBeforeMinutes: 10,
      notifyTaskDue: true,
      notifyTaskCompleted: true,
    });
    // Whatever it sends must be something the server would accept.
    expect(settingsPatchSchema.safeParse(lastPatch()).success).toBe(true);
  });

  it("hides the lead time while nothing reminds beforehand", () => {
    renderWith(makeSettings({ notifyEventBefore: false }));
    expect(screen.queryByRole("combobox", { name: "Before event" })).toBeNull();
  });
});

describe("the lead time", () => {
  it("offers the three presets and a custom option", () => {
    renderWith(makeSettings());
    const select = screen.getByRole("combobox", { name: "Before event" });
    const labels = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(labels).toEqual(["10 minutes", "30 minutes", "1 hour", "Custom"]);
  });

  it("stores a preset as minutes", async () => {
    renderWith(makeSettings());
    fireEvent.change(screen.getByRole("combobox", { name: "Before event" }), {
      target: { value: "60" },
    });
    await save();
    expect(lastPatch().notifyEventBeforeMinutes).toBe(60);
  });

  it("reads a stored value back in the largest unit that fits", () => {
    renderWith(makeSettings({ notifyEventBeforeMinutes: 120 }));
    expect(screen.getByRole("spinbutton", { name: "How long" })).toHaveProperty("value", "2");
    expect(screen.getByRole("combobox", { name: "Unit" })).toHaveProperty("value", "hours");
  });

  it("stores hours and days as minutes, whatever the picker shows", async () => {
    renderWith(makeSettings({ notifyEventBeforeMinutes: 120 }));

    fireEvent.change(screen.getByRole("combobox", { name: "Unit" }), { target: { value: "days" } });
    await save();
    expect(lastPatch().notifyEventBeforeMinutes).toBe(2 * 24 * 60);
  });

  it("says so when the lead time is longer than a week", () => {
    renderWith(makeSettings({ notifyEventBeforeMinutes: 8 * 24 * 60 }));
    expect(screen.getByRole("alert").textContent).toContain("more than 7 days");
  });

  it("leaves an awkward custom value in minutes rather than inventing a unit", () => {
    renderWith(makeSettings({ notifyEventBeforeMinutes: 90 }));
    expect(screen.getByRole("spinbutton", { name: "How long" })).toHaveProperty("value", "90");
    expect(screen.getByRole("combobox", { name: "Unit" })).toHaveProperty("value", "minutes");
  });
});

describe("who may change them", () => {
  it("lets a punched-in member read the household's choices and change none", () => {
    renderWith(makeSettings(), "member");

    for (const name of ["At time of event", "Before event", "When Due", "When Completed"]) {
      expect(screen.getByRole("switch", { name })).toHaveProperty("disabled", true);
    }
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Parents only")).toBeTruthy();
  });

  it("still lets a member quieten their OWN device", () => {
    // The two device switches are not household policy: they are this screen's
    // own, saved to this browser, and a child at the wall tablet may turn the
    // sound off without asking a parent (FR-815).
    renderWith(makeSettings(), "member");
    const device = screen.getByRole("group", { name: "This device" });

    for (const control of within(device).getAllByRole("switch")) {
      expect(control).toHaveProperty("disabled", false);
    }
  });
});

describe("this device's own two", () => {
  it("shows a banner by default and stays silent by default", () => {
    renderWith(makeSettings());
    const device = screen.getByRole("group", { name: "This device" });

    expect(within(device).getByRole("switch", { name: "Show reminders on this screen" })).toHaveProperty("checked", true);
    expect(within(device).getByRole("switch", { name: "Play a sound with them" })).toHaveProperty("checked", false);
  });

  it("is saved without a Save button, because it never leaves this browser", () => {
    renderWith(makeSettings());
    const device = screen.getByRole("group", { name: "This device" });
    fireEvent.click(within(device).getByRole("switch", { name: "Play a sound with them" }));

    expect(within(device).getByRole("switch", { name: "Play a sound with them" })).toHaveProperty("checked", true);
    expect(updateHouseholdSettings).not.toHaveBeenCalled();
  });
});

describe("saying where a reminder appears", () => {
  it("tells the household plainly, so nobody waits for a phone to buzz", () => {
    renderWith(makeSettings());
    const notice = screen.getByText(/Reminders appear on screens/i);
    expect(notice.textContent).toContain("Nothing is sent to a phone");
  });
});
