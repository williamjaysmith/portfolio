/**
 * 008 T039: one event's own reminder, in the form (FR-808, R809).
 *
 * The control has three states and no fourth, which is the shape the reference
 * verifies — a calendar-wide default and a per-event reminder that overrides it
 * [VERIFIED](32083277890075). What the sources never address is how to say
 * "this one, deliberately, never reminds", so `none` is ours (Assumption 4) and
 * telling it apart from `inherit` is what most of this file is about.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MAX_LEAD_MINUTES } from "@/lib/family/notifications/settings";
import type { EventReminder } from "@/lib/family/types";

import { ReminderFieldset } from "../ReminderFieldset";

function renderField(value: EventReminder) {
  const onChange = vi.fn<(reminder: EventReminder) => void>();
  render(<ReminderFieldset value={value} onChange={onChange} />);
  return onChange;
}

function chooseMode(mode: string): void {
  fireEvent.change(screen.getByRole("combobox", { name: "Reminder" }), { target: { value: mode } });
}

function lastChange(onChange: ReturnType<typeof renderField>): EventReminder {
  const call = onChange.mock.calls.at(-1);
  if (!call) throw new Error("onChange was never called");
  return call[0];
}

describe("the three states", () => {
  it("offers exactly three, and no fourth", () => {
    renderField({ mode: "inherit" });
    const labels = Array.from(
      screen.getByRole("combobox", { name: "Reminder" }).querySelectorAll("option"),
    ).map((option) => option.textContent);

    expect(labels).toEqual(["The household's setting", "No reminder", "Its own"]);
  });

  it("starts on the household's setting, which is what an event nobody thinks about keeps", () => {
    renderField({ mode: "inherit" });
    expect(screen.getByRole("combobox", { name: "Reminder" })).toHaveProperty("value", "inherit");
  });

  it("tells silence apart from inheritance — the reason the mode exists at all", () => {
    const onChange = renderField({ mode: "inherit" });
    chooseMode("none");
    expect(lastChange(onChange)).toEqual({ mode: "none" });
  });

  it("shows nothing extra for the two simple states", () => {
    renderField({ mode: "none" });
    expect(screen.queryByRole("switch", { name: "As it starts" })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "Minutes before" })).toBeNull();
  });
});

describe("its own", () => {
  it("opens on a usable default rather than an empty, invalid one", () => {
    const onChange = renderField({ mode: "inherit" });
    chooseMode("custom");
    expect(lastChange(onChange)).toEqual({ mode: "custom", atTime: false, beforeMinutes: 10 });
  });

  it("offers both halves independently, because the household's own two are independent", () => {
    const onChange = renderField({ mode: "custom", atTime: false, beforeMinutes: 10 });
    fireEvent.click(screen.getByRole("switch", { name: "As it starts" }));
    expect(lastChange(onChange)).toEqual({ mode: "custom", atTime: true, beforeMinutes: 10 });
  });

  it("can carry the lead time alone, or the start alone", () => {
    const onChange = renderField({ mode: "custom", atTime: true, beforeMinutes: 10 });
    fireEvent.click(screen.getByRole("switch", { name: "Before it starts" }));
    expect(lastChange(onChange)).toEqual({ mode: "custom", atTime: true, beforeMinutes: null });
  });

  it("keeps a custom choice when the mode is re-picked, rather than resetting it", () => {
    const onChange = renderField({ mode: "custom", atTime: true, beforeMinutes: 45 });
    chooseMode("custom");
    // Re-choosing the state somebody is already in must not throw their work away.
    expect(onChange).not.toHaveBeenCalledWith({ mode: "custom", atTime: false, beforeMinutes: 10 });
  });

  it("says so when it carries neither half — that is No reminder written badly", () => {
    renderField({ mode: "custom", atTime: false, beforeMinutes: null });
    expect(screen.getByRole("alert").textContent).toContain("Choose when it reminds");
  });

  it("says so when the lead time is longer than a week", () => {
    renderField({ mode: "custom", atTime: false, beforeMinutes: MAX_LEAD_MINUTES + 1 });
    expect(screen.getByRole("alert").textContent).toContain("more than 7 days");
  });

  it("accepts seven days to the minute", () => {
    renderField({ mode: "custom", atTime: false, beforeMinutes: MAX_LEAD_MINUTES });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
