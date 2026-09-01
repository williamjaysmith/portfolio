import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTION_MESSAGES, type ActionResult } from "@/lib/family/errors";
import type {
  Household,
  HouseholdSettings,
  HouseholdSettingsPatch,
} from "@/lib/family/types";
import { settingsPatchSchema } from "@/lib/family/validation";

import type { FamilyContextValue } from "../FamilyProvider";
import { ok } from "./action-result";
import { makeActor, makeContext, makeHousehold, makeSettings, withFamily } from "./family-test-utils";

type SettingsResult = ActionResult<{ household: Household; settings: HouseholdSettings }>;

const updateHouseholdSettings =
  vi.fn<(patch: HouseholdSettingsPatch) => Promise<SettingsResult>>();

vi.mock("@/lib/family/actions/settings", () => ({
  updateHouseholdSettings: (patch: HouseholdSettingsPatch) => updateHouseholdSettings(patch),
}));

const { HouseholdSection } = await import("../settings/HouseholdSection");

const household = makeHousehold({ name: "The Smiths" });
const settings = makeSettings({
  showNameNotDate: false,
  timeFormat: "24h",
  startWeekOn: 1,
  punchOutMinutes: 15,
  textSize: "large",
  density: "snug",
});

const PUNCH_OUT_MESSAGE = "Punch-out time must be between 1 and 60 minutes.";

const saved: SettingsResult = ok({ household, settings });

const validationFailure: SettingsResult = {
  ok: false,
  error: "VALIDATION",
  message: ACTION_MESSAGES.VALIDATION,
  fieldErrors: { punchOutMinutes: [PUNCH_OUT_MESSAGE] },
};

function renderSection(overrides: Partial<FamilyContextValue> = {}): void {
  const context = makeContext({
    household,
    settings,
    actor: makeActor("parent"),
    ...overrides,
  });
  render(withFamily(context, <HouseholdSection />));
}

/** The patch the form actually sent, typed as the action receives it. */
function lastPatch(): HouseholdSettingsPatch {
  const call = updateHouseholdSettings.mock.calls.at(-1);
  if (!call) throw new Error("updateHouseholdSettings was never called");
  return call[0];
}

function save(): void {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

/** FR-031/FR-043: everyone can read the household preferences; only a parent saves. */
describe("HouseholdSection", () => {
  beforeEach(() => {
    updateHouseholdSettings.mockReset().mockResolvedValue(saved);
  });

  it("shows the household as it is stored, not the defaults", () => {
    renderSection();

    expect(screen.getByLabelText("Household name")).toHaveValue("The Smiths");
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(screen.getByLabelText("Clock")).toHaveValue("24h");
    expect(screen.getByLabelText("Start week on")).toHaveValue("1");
    expect(screen.getByLabelText("Text size")).toHaveValue("large");
    expect(screen.getByLabelText("Display density")).toHaveValue("snug");
    expect(screen.getByLabelText("Punch out after (minutes)")).toHaveValue(15);
  });

  it("sends the name and every preference in the types the action's schema demands", async () => {
    renderSection();

    fireEvent.change(screen.getByLabelText("Household name"), {
      target: { value: "The Smith Family" },
    });
    fireEvent.change(screen.getByLabelText("Start week on"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Punch out after (minutes)"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("switch"));
    save();

    await waitFor(() => expect(updateHouseholdSettings).toHaveBeenCalledTimes(1));
    const patch = lastPatch();

    expect(patch).toEqual({
      householdName: "The Smith Family",
      showNameNotDate: true,
      timeFormat: "24h",
      startWeekOn: 0,
      punchOutMinutes: 7,
      textSize: "large",
      density: "snug",
    });
    // The select and the number input both hand back strings; sending them
    // through as strings is refused by the action before it reaches the row.
    expect(typeof patch.punchOutMinutes).toBe("number");
    expect(typeof patch.startWeekOn).toBe("number");
    expect(settingsPatchSchema.safeParse(patch).success).toBe(true);
  });

  it("keeps Monday as the number 1 rather than the option's string", async () => {
    renderSection({ settings: makeSettings({ startWeekOn: 0 }) });

    fireEvent.change(screen.getByLabelText("Start week on"), { target: { value: "1" } });
    save();

    await waitFor(() => expect(updateHouseholdSettings).toHaveBeenCalledTimes(1));
    expect(lastPatch().startWeekOn).toBe(1);
    expect(settingsPatchSchema.safeParse(lastPatch()).success).toBe(true);
  });

  it("confirms that the change was stored", async () => {
    renderSection();
    save();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
  });

  it("puts a rejected field's reason beside that field", async () => {
    updateHouseholdSettings.mockResolvedValue(validationFailure);
    renderSection();
    save();

    expect(await screen.findByText(PUNCH_OUT_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("clears the previous complaint once the next save succeeds", async () => {
    updateHouseholdSettings.mockResolvedValue(validationFailure);
    renderSection();
    save();
    expect(await screen.findByText(PUNCH_OUT_MESSAGE)).toBeInTheDocument();

    updateHouseholdSettings.mockResolvedValue(saved);
    save();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(screen.queryByText(PUNCH_OUT_MESSAGE)).not.toBeInTheDocument();
  });

  it("reports a refusal the client did not predict", async () => {
    updateHouseholdSettings.mockResolvedValue({
      ok: false,
      error: "FORBIDDEN",
      message: ACTION_MESSAGES.FORBIDDEN,
    });
    renderSection();
    save();

    expect(await screen.findByRole("alert")).toHaveTextContent("Only a parent can change this.");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("lets a punched-in child read the settings but not change them (FR-015)", () => {
    renderSection({ actor: makeActor("member") });

    expect(screen.getByLabelText("Household name")).toHaveValue("The Smiths");
    expect(screen.getByText("Parents only")).toBeInTheDocument();

    expect(screen.getByLabelText("Household name")).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
    for (const select of screen.getAllByRole("combobox")) expect(select).toBeDisabled();
    expect(screen.getByLabelText("Punch out after (minutes)")).toBeDisabled();

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(updateHouseholdSettings).not.toHaveBeenCalled();
  });
});
