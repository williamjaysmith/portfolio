/**
 * The words a reminder says (008 FR-814, FR-818, FR-819).
 *
 * One implementation, called by whichever source produced the reminder — an
 * event, a chore falling due, a chore finished. A second implementation
 * reachable by a different path is how two screens come to say different things
 * about the same event.
 *
 * The completion's shape is the reference's own. Its documented example is a
 * push banner reading "Olivia dried the dinner dishes"
 * [VERIFIED](54930439904923) — the person, the verb, the thing. Ours reads
 * "Cleo finished Practice piano", which is the same sentence over a task
 * summary that is already imperative.
 */

export interface ReminderMessage {
  title: string;
  body: string;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * A lead time in the words a person would use: "10 minutes", "1 hour",
 * "2 days". Stored minutes are always minutes (R810), so this is the only
 * place that turns 120 back into "2 hours".
 *
 * A lead that is not a whole number of hours or days stays in minutes rather
 * than becoming "1 hour 30 minutes": the presets are 10, 30 and 60, so an
 * awkward value can only come from the custom field, and a household that
 * typed 90 minutes is not confused by reading "90 minutes".
 */
export function leadPhrase(minutes: number): string {
  if (minutes % MINUTES_PER_DAY === 0) return plural(minutes / MINUTES_PER_DAY, "day");
  if (minutes % MINUTES_PER_HOUR === 0) return plural(minutes / MINUTES_PER_HOUR, "hour");
  return plural(minutes, "minute");
}

/**
 * An event's reminder. `leadMinutes` is null for the at-the-time reminder,
 * which the reference describes as firing "when the event begins"
 * [VERIFIED](36836043247131).
 */
export function eventReminderMessage(
  summary: string,
  leadMinutes: number | null,
): ReminderMessage {
  return {
    title: summary,
    body: leadMinutes === null ? "Starting now" : `in ${leadPhrase(leadMinutes)}`,
  };
}

/**
 * A chore falling due. The reference fires this only for chores due at a
 * specific time [VERIFIED](36836043247131), which is why there is no
 * all-day variant of it.
 *
 * `who` is null on an up-for-grabs chore, which belongs to the household
 * rather than to anybody (Phase 3 FR-365) — so the message names nobody
 * rather than inventing an owner.
 */
export function taskDueMessage(summary: string, who: string | null): ReminderMessage {
  return { title: summary, body: who === null ? "Due now" : `${who} — due now` };
}

/**
 * A chore finished. The one notification anywhere in the reference that names
 * a person, and the only reason `who` is required here.
 */
export function taskDoneMessage(summary: string, who: string): ReminderMessage {
  return { title: `${who} finished ${summary}`, body: "" };
}
