"use client";

import { repeatChoiceOf } from "@/lib/family/calendar/expand";

import { useFamily } from "../../components/FamilyProvider";
import { DeleteConfirm } from "./DeleteConfirm";
import { seedOf } from "./event-drafts";
import { EventDetails } from "./EventDetails";
import { EventForm } from "./EventForm";
import { ScopeDialog } from "./ScopeDialog";
import type { CalendarEditor } from "./useCalendarEditor";

/**
 * Renders whichever US2 surfaces `useCalendarEditor` says are open, and
 * nothing else — every decision is the hook's. Three slots, always in the
 * same positions, so a surface that stays open while another stacks on top
 * (the edit form under the scope question, the details under the delete
 * confirmation) keeps its instance and its typing across the transition.
 * Native `<dialog>`s stack in the top layer, so the newest is the modal one.
 */

export interface EventEditorProps {
  editor: CalendarEditor;
}

function FormSlot({ editor, zone }: { editor: CalendarEditor; zone: string }) {
  const { surface } = editor;
  if (surface.kind === "create") {
    return (
      <EventForm mode="create" seed={surface.seed} onSubmit={editor.submit} onClose={editor.close} />
    );
  }
  if (surface.kind !== "edit") return null;
  return (
    <EventForm
      mode="edit"
      seed={seedOf(surface.target, zone)}
      onSubmit={editor.submit}
      onClose={editor.close}
    />
  );
}

function DetailsSlot({ editor, zone }: { editor: CalendarEditor; zone: string }) {
  const { categories, settings } = useFamily();
  const { surface } = editor;
  if (surface.kind !== "details" && surface.kind !== "delete") return null;
  const { occurrence, event } = surface.target;
  return (
    <EventDetails
      occurrence={occurrence}
      repeat={repeatChoiceOf(event.rrule, zone)}
      categories={categories}
      zone={zone}
      timeFormat={settings.timeFormat}
      onEdit={editor.edit}
      onDelete={editor.requestDelete}
      onClose={editor.close}
    />
  );
}

/** The scope question (edit or delete) or the delete confirmation — the topmost dialog. */
function QuestionSlot({ editor }: { editor: CalendarEditor }) {
  const { surface } = editor;
  if (surface.kind === "edit" && surface.scopeQuestion !== null) {
    return (
      <ScopeDialog
        mode="edit"
        // FR-287/239: series-only fields changed, so "This event" is not offered.
        categoriesChanged={surface.scopeQuestion.seriesFieldsChanged}
        onChoose={editor.chooseScope}
        onCancel={editor.cancelScope}
      />
    );
  }
  if (surface.kind !== "delete") return null;
  if (surface.step === "scope") {
    return <ScopeDialog mode="delete" onChoose={editor.chooseScope} onCancel={editor.cancelScope} />;
  }
  return (
    <DeleteConfirm
      summary={surface.target.occurrence.summary}
      pending={surface.pending}
      onConfirm={() => void editor.confirmDelete()}
      onCancel={editor.cancelScope}
    />
  );
}

export function EventEditor({ editor }: EventEditorProps) {
  const { settings } = useFamily();
  const zone = settings.timezone;
  return (
    <>
      <FormSlot editor={editor} zone={zone} />
      <DetailsSlot editor={editor} zone={zone} />
      <QuestionSlot editor={editor} />
    </>
  );
}
