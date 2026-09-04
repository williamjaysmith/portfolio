import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEvent, deleteEvent, updateEvent } from "@/lib/family/actions/events";
import { ACTION_MESSAGES } from "@/lib/family/errors";
import { familyKeys } from "@/lib/family/queries";
import type { Category, Event, Occurrence } from "@/lib/family/types";

import { fail, ok } from "../../../components/__tests__/action-result";
import type { FamilyContextValue } from "../../../components/FamilyProvider";
import {
  makeCategory,
  makeContext,
  stubDialog,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import { slotSeedOf } from "../event-drafts";
import { EventEditor } from "../EventEditor";
import { GONE_MESSAGE, useCalendarEditor } from "../useCalendarEditor";

/**
 * T050 — the write surface wired end to end against mocked actions: the two
 * create doors (FR-254/255), details → Edit → form (FR-256/257), the scope
 * question asked AFTER the form and BEFORE the punch-in (FR-250, FR-287),
 * delete through scope then confirmation (FR-258, US2-10/11/12), every
 * commit through `withActor` (FR-270/275, US2-1), and FR-288's two
 * refusals. The grid's cache is never written by this layer (R208).
 */

vi.mock("@/lib/family/actions/events", () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

const HOUSEHOLD_ID = "household-1";
const ZONE = "America/Chicago";
const WEEK_START = "2026-10-04";
const ALEX = "11111111-1111-4111-8111-111111111111";
const CLEO = "22222222-2222-4222-8222-222222222222";

const DRAW_ORDER: Category[] = [
  makeCategory({ id: ALEX, label: "Alex", sortOrder: 1000 }),
  makeCategory({ id: CLEO, label: "Cleo", role: "member", sortOrder: 2000 }),
];

/** The weekly Piano series: Tuesdays 17:00–17:45 Chicago from 2026-09-15. */
function makeSeries(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-piano",
    householdId: HOUSEHOLD_ID,
    summary: "Piano",
    description: null,
    location: null,
    times: { allDay: false, startsAt: "2026-09-15T22:00:00.000Z", endsAt: "2026-09-15T22:45:00.000Z" },
    timezone: ZONE,
    rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261216T055959Z;WKST=SU;BYDAY=TU",
    countdownEnabled: false,
    categoryIds: [CLEO],
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    eventId: "event-piano",
    occurrenceDate: "2026-10-06",
    isRepeating: true,
    summary: "Piano",
    description: null,
    location: null,
    categoryIds: [CLEO],
    times: { allDay: false, startsAt: "2026-10-06T22:00:00.000Z", endsAt: "2026-10-06T22:45:00.000Z" },
    ...overrides,
  };
}

/** A one-off in the same week: Dentist, Tuesday 09:00–10:00 Chicago. */
const dentist = makeSeries({
  id: "event-dentist",
  summary: "Dentist",
  rrule: null,
  categoryIds: [ALEX],
  times: { allDay: false, startsAt: "2026-10-06T14:00:00.000Z", endsAt: "2026-10-06T15:00:00.000Z" },
});
const dentistOccurrence = makeOccurrence({
  eventId: "event-dentist",
  isRepeating: false,
  summary: "Dentist",
  categoryIds: [ALEX],
  times: dentist.times,
});

function Harness({ occurrence }: { occurrence: Occurrence }) {
  const editor = useCalendarEditor({ householdId: HOUSEHOLD_ID, weekStart: WEEK_START, zone: ZONE });
  return (
    <>
      <button type="button" onClick={() => editor.openCreate()}>
        Add event
      </button>
      <button type="button" onClick={() => editor.openCreate(slotSeedOf(ZONE, "2026-10-06", 570))}>
        Tap slot
      </button>
      <button type="button" onClick={() => editor.openDetails(occurrence)}>
        Open
      </button>
      {editor.notice ? <p role="alert">{editor.notice}</p> : null}
      <EventEditor editor={editor} />
    </>
  );
}

function renderEditor(
  occurrence: Occurrence = makeOccurrence(),
  events: Event[] = [makeSeries(), dentist],
  context: Partial<FamilyContextValue> = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(familyKeys.week(HOUSEHOLD_ID, WEEK_START), events);
  const withActor: FamilyContextValue["withActor"] = vi.fn(async (run) => run());
  render(
    <QueryClientProvider client={client}>
      {withFamily(
        makeContext({ categories: DRAW_ORDER, withActor, ...context }),
        <Harness occurrence={occurrence} />,
      )}
    </QueryClientProvider>,
  );
  return { client, withActor };
}

function type(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

function click(name: string | RegExp, role = "button"): void {
  fireEvent.click(screen.getByRole(role, { name }));
}

/** A button inside the named dialog — dialogs stack, and their verbs repeat. */
function clickIn(dialogName: string, name: string, role: "dialog" | "alertdialog" = "dialog"): void {
  fireEvent.click(within(screen.getByRole(role, { name: dialogName })).getByRole("button", { name }));
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function deviceWall(instantMs: number): { date: string; time: string } {
  const at = new Date(instantMs);
  return {
    date: `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`,
    time: `${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
  };
}

describe("the write surface", () => {
  beforeEach(() => {
    stubDialog();
    vi.mocked(createEvent).mockReset().mockResolvedValue(ok(makeSeries()));
    vi.mocked(updateEvent)
      .mockReset()
      .mockResolvedValue(ok({ eventId: "event-piano", splitEventId: null }));
    vi.mocked(deleteEvent).mockReset().mockResolvedValue(ok(null));
  });

  describe("creating (FR-254/255, US2-1)", () => {
    it("opens a bare form from the create control and commits through withActor", async () => {
      const { withActor } = renderEditor();

      click("Add event");
      const form = screen.getByRole("dialog", { name: "Add an event" });
      type(screen.getByLabelText("Title"), "Swim lesson");
      click("Save");

      await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
      expect(vi.mocked(createEvent).mock.calls[0][0]).toMatchObject({
        summary: "Swim lesson",
        repeat: { kind: "never" },
      });
      expect(withActor).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(form).not.toBeInTheDocument());
    });

    it("prefills a tapped slot with that day, that 15-minute time and a one-hour end", () => {
      renderEditor();

      click("Tap slot");

      const start = deviceWall(Date.parse("2026-10-06T14:30:00Z")); // 09:30 Chicago
      const end = deviceWall(Date.parse("2026-10-06T15:30:00Z"));
      expect(screen.getByLabelText("Start date")).toHaveValue(start.date);
      expect(screen.getByLabelText("Start time")).toHaveValue(start.time);
      expect(screen.getByLabelText("End date")).toHaveValue(end.date);
      expect(screen.getByLabelText("End time")).toHaveValue(end.time);
    });

    it("shows a dismissed punch-in as the refusal it is, with nothing written", async () => {
      renderEditor(makeOccurrence(), [makeSeries(), dentist], {
        withActor: vi.fn(async () => fail("NO_ACTOR")),
      });

      click("Add event");
      type(screen.getByLabelText("Title"), "Swim lesson");
      click("Save");

      await screen.findByText(ACTION_MESSAGES.NO_ACTOR);
      expect(createEvent).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Add an event" })).toBeInTheDocument();
    });

    it("never writes the week cache itself — the refetch after invalidation redraws (R208)", async () => {
      const { client } = renderEditor();
      const before = client.getQueryData(familyKeys.week(HOUSEHOLD_ID, WEEK_START));

      click("Add event");
      type(screen.getByLabelText("Title"), "Swim lesson");
      click("Save");

      await waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1));
      expect(client.getQueryData(familyKeys.week(HOUSEHOLD_ID, WEEK_START))).toBe(before);
    });
  });

  describe("details and editing (FR-256/257)", () => {
    it("opens details for a tapped occurrence, and the edit form from Edit only", () => {
      renderEditor();

      click("Open");
      const details = screen.getByRole("dialog", { name: "Piano" });
      expect(details).toHaveTextContent("Every week on Tuesday until December 15, 2026");
      expect(screen.queryByRole("dialog", { name: "Edit event" })).toBeNull();

      click("Edit");
      expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("Piano");
      expect(screen.getByLabelText("Repeats")).toHaveValue("weekly");
      expect(screen.getByRole("checkbox", { name: "Cleo" })).toBeChecked();
    });

    it("says the event no longer exists when its row is not in the week", () => {
      renderEditor(makeOccurrence({ eventId: "event-gone" }));

      click("Open");

      expect(screen.getByRole("alert")).toHaveTextContent(GONE_MESSAGE);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("asks the scope question after the form and writes at the chosen scope (US2-7)", async () => {
      const { withActor } = renderEditor();

      click("Open");
      click("Edit");
      type(screen.getByLabelText("Title"), "Piano recital");
      click("Save");

      const question = await screen.findByRole("dialog", { name: "Edit repeating event" });
      expect(withActor).not.toHaveBeenCalled();
      expect(screen.getByRole("radio", { name: "This event" })).toBeInTheDocument();
      click("This event", "radio");
      click("Continue");

      await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
      expect(updateEvent).toHaveBeenCalledWith({
        id: "event-piano",
        patch: { summary: "Piano recital" },
        scope: "this",
        occurrenceDate: "2026-10-06",
      });
      expect(withActor).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(question).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit event" })).toBeNull());
    });

    it("does not offer 'This event' when Profiles/Labels changed, and writes them at series scope (US2-18)", async () => {
      renderEditor();

      click("Open");
      click("Edit");
      click("Alex", "checkbox");
      click("Save");

      await screen.findByRole("dialog", { name: "Edit repeating event" });
      expect(screen.queryByRole("radio", { name: "This event" })).toBeNull();
      click("All events", "radio");
      click("Continue");

      await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
      expect(updateEvent).toHaveBeenCalledWith({
        id: "event-piano",
        patch: { categoryIds: [ALEX, CLEO] },
        scope: "all",
      });
    });

    it("keeps the form open with its typing when the scope question is dismissed (FR-249)", async () => {
      renderEditor();

      click("Open");
      click("Edit");
      type(screen.getByLabelText("Title"), "Piano recital");
      click("Save");

      await screen.findByRole("dialog", { name: "Edit repeating event" });
      clickIn("Edit repeating event", "Cancel");

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Edit repeating event" })).toBeNull(),
      );
      expect(updateEvent).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("Piano recital");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    it("asks no scope question for a one-off (FR-238, US2-12)", async () => {
      renderEditor(dentistOccurrence);

      click("Open");
      click("Edit");
      type(screen.getByLabelText("Title"), "Dentist — Alex");
      click("Save");

      await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
      expect(updateEvent).toHaveBeenCalledWith({
        id: "event-dentist",
        patch: { summary: "Dentist — Alex" },
      });
      expect(screen.queryByRole("dialog", { name: "Edit repeating event" })).toBeNull();
    });

    it("closes without writing when nothing changed", async () => {
      renderEditor(dentistOccurrence);

      click("Open");
      click("Edit");
      click("Save");

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(updateEvent).not.toHaveBeenCalled();
    });

    it("closes the form and says so when another device deleted the event first (FR-288)", async () => {
      vi.mocked(updateEvent).mockResolvedValue(fail("NOT_FOUND"));
      renderEditor(dentistOccurrence);

      click("Open");
      click("Edit");
      type(screen.getByLabelText("Title"), "Dentist — Alex");
      click("Save");

      await screen.findByText(GONE_MESSAGE);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(createEvent).not.toHaveBeenCalled();
    });

    it("lands any other refusal in the form, entries intact", async () => {
      vi.mocked(updateEvent).mockResolvedValue(fail("UNAVAILABLE"));
      renderEditor(dentistOccurrence);

      click("Open");
      click("Edit");
      type(screen.getByLabelText("Title"), "Dentist — Alex");
      click("Save");

      await screen.findByText(ACTION_MESSAGES.UNAVAILABLE);
      expect(screen.getByRole("dialog", { name: "Edit event" })).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("Dentist — Alex");
    });
  });

  describe("deleting (FR-258, US2-10/11/12/19)", () => {
    it("confirms, then deletes a one-off with no scope question", async () => {
      const { withActor } = renderEditor(dentistOccurrence);

      click("Open");
      click("Delete");

      expect(screen.queryByRole("dialog", { name: "Delete repeating event" })).toBeNull();
      const confirm = screen.getByRole("alertdialog", { name: "Delete “Dentist”?" });
      expect(deleteEvent).not.toHaveBeenCalled();
      clickIn("Delete “Dentist”?", "Delete", "alertdialog");

      await waitFor(() => expect(deleteEvent).toHaveBeenCalledTimes(1));
      expect(deleteEvent).toHaveBeenCalledWith({ id: "event-dentist", confirm: true });
      expect(withActor).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(confirm).not.toBeInTheDocument());
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("asks the scope first, confirms second, then deletes at that scope", async () => {
      const { withActor } = renderEditor();

      click("Open");
      click("Delete");

      screen.getByRole("dialog", { name: "Delete repeating event" });
      click("This and future events", "radio");
      click("Continue");

      expect(withActor).not.toHaveBeenCalled();
      clickIn("Delete “Piano”?", "Delete", "alertdialog");

      await waitFor(() => expect(deleteEvent).toHaveBeenCalledTimes(1));
      expect(deleteEvent).toHaveBeenCalledWith({
        id: "event-piano",
        confirm: true,
        scope: "this_and_future",
        occurrenceDate: "2026-10-06",
      });
    });

    it("returns to the details when the scope question or the confirmation is dismissed", () => {
      renderEditor();

      click("Open");
      click("Delete");
      clickIn("Delete repeating event", "Cancel");

      expect(screen.queryByRole("dialog", { name: "Delete repeating event" })).toBeNull();
      expect(screen.getByRole("dialog", { name: "Piano" })).toBeInTheDocument();

      click("Delete");
      click("All events", "radio");
      click("Continue");
      clickIn("Delete “Piano”?", "Cancel", "alertdialog");

      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.getByRole("dialog", { name: "Piano" })).toBeInTheDocument();
      expect(deleteEvent).not.toHaveBeenCalled();
    });

    it("surfaces a refused delete as a notice and closes the dialogs", async () => {
      vi.mocked(deleteEvent).mockResolvedValue(fail("NOT_FOUND"));
      renderEditor(dentistOccurrence);

      click("Open");
      click("Delete");
      clickIn("Delete “Dentist”?", "Delete", "alertdialog");

      await screen.findByText(GONE_MESSAGE);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });
});
