import type { Metadata } from "next";

import { localDateOf, weekStartOf } from "@/lib/family/calendar/dates";
import { getMember } from "@/lib/family/guards";
import {
  fetchSettings,
  fetchTaskCarryForward,
  fetchTaskCursors,
  fetchTaskResolutions,
  fetchTasks,
} from "@/lib/family/queries";
import { createClient } from "@/lib/family/supabase/server";
import { timeOfDayAt } from "@/lib/family/tasks/dates";
import type { HouseholdSettings, Task, TaskCursor, TaskResolution, TimeOfDay } from "@/lib/family/types";

import { TasksBoard } from "./components/TasksBoard";

export const metadata: Metadata = { title: "Tasks" };

/**
 * The Tasks board (T046, R314): a server component that performs the board's
 * **four** reads under the signed-in session (RLS, the server client — never
 * the admin client) and seeds each as `initialData` for its own key, so the
 * wall tablet's first paint is the board itself with no loading state.
 *
 * All four, and the cursor tails especially: `family.task_cursors` is a view
 * with no foreign key to embed on, so without its own read every Completed Date
 * chore would be missing from that first paint — the one mode this design
 * exists to serve.
 *
 * The layout above is the gate: with no member and no settings row it is
 * already redirecting the whole render to sign-in or not-authorized, so this
 * page only has to decline to fetch, never to decide the door.
 *
 * **The degradation path (constitution §VI).** There is no `error.tsx`
 * anywhere under `app/`, so a failing read here would throw the whole route
 * rather than degrade — and until the migrations are pushed to the hosted
 * project (T084) these four reads hit tables that do not exist. So the reads
 * are taken together and a failure renders an honest unavailable state with the
 * tab's chrome intact. `Promise.all` is what makes it all-or-nothing: a board
 * built from two reads that worked and two that did not would be a *wrong*
 * board, which is worse than no board.
 */

/** Everything the four reads produce, or nothing at all. */
interface BoardData {
  tasks: Task[];
  resolutions: TaskResolution[];
  carry: TaskResolution[];
  cursors: TaskCursor[];
}

/** The household's own "now", read once so the date and the window agree. */
interface BoardDay {
  date: string;
  window: TimeOfDay;
}

/**
 * A named helper, not an inline `Date.now()`: this is an async request handler
 * where reading the wall clock is the point, but the React purity lint reads
 * any capitalised component body as a render and refuses impure calls there.
 */
function currentDay(zone: HouseholdSettings["timezone"]): BoardDay {
  const at = Date.now();
  return { date: localDateOf(zone, at), window: timeOfDayAt(zone, at) };
}

async function loadBoard(
  householdId: string,
  settings: HouseholdSettings,
  day: BoardDay,
): Promise<BoardData | null> {
  try {
    const supabase = await createClient();
    const [tasks, resolutions, carry, cursors] = await Promise.all([
      fetchTasks(supabase, householdId),
      fetchTaskResolutions(supabase, householdId, weekStartOf(day.date, settings.startWeekOn)),
      fetchTaskCarryForward(supabase, householdId, day.date, settings.startWeekOn),
      fetchTaskCursors(supabase, householdId),
    ]);
    return { tasks, resolutions, carry, cursors };
  } catch (error) {
    // Logged as a string server-side and never surfaced verbatim, exactly as
    // the action layer treats a database failure.
    console.error("[family] the tasks board could not be read", error);
    return null;
  }
}

/** The honest empty-handed state: the tab, named, saying what is wrong. */
function TasksUnavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-(--fam-edge-inset) text-center">
      <h1 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) text-(--fam-text-primary)">
        Tasks
      </h1>
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        Tasks can&rsquo;t be loaded right now. Everything else still works.
      </p>
    </div>
  );
}

export default async function TasksPage() {
  const member = await getMember();
  if (member === null) return null;

  const supabase = await createClient();
  const settings = await fetchSettings(supabase, member.householdId);
  if (settings === null) return null;

  const day = currentDay(settings.timezone);
  const board = await loadBoard(member.householdId, settings, day);
  if (board === null) return <TasksUnavailable />;

  return (
    <TasksBoard
      initialDate={day.date}
      initialWindow={day.window}
      initialTasks={board.tasks}
      initialResolutions={board.resolutions}
      initialCarry={board.carry}
      initialCursors={board.cursors}
    />
  );
}
