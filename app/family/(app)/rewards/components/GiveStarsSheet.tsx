"use client";

import { useId, useMemo, useState } from "react";

import type { FieldErrors } from "@/lib/family/errors";
import { beforeAndAfterOf, type BalanceChange, type BeforeAndAfter } from "@/lib/family/rewards/stars";
import type { Category } from "@/lib/family/types";
import { adjustStarsSchema, parseOrThrow } from "@/lib/family/validation";

import {
  settleSubmit,
  toggled,
  useSubmission,
  type Settled,
  type SubmitOutcome,
} from "../../components/formSubmit";
import { ProfileMultiSelect } from "../../components/ProfileMultiSelect";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { useModalDialog } from "../../components/useModalDialog";

/**
 * Give stars by hand (004 T046 — FR-434, FR-435, FR-436, SC-412): a parent
 * chooses one or more Profiles, types one whole amount — negative to take
 * stars away — and reviews a **before-and-after** table of every chosen
 * Profile's balance before confirming, the reference's own flow (30456865333403).
 *
 * **The picker lists Profiles only** (FR-414). A Label has no balance and
 * nobody to credit, so a Label among what is passed in is simply not offered;
 * the Profiles are the household's, in its order, and the chosen ids are sent
 * in that order whatever order they were ticked in.
 *
 * **The table is `beforeAndAfterOf` over the balances the tab already holds**
 * and nothing is counted here (R402): one row per chosen Profile, a Profile
 * with no row reading 0. A row that would end below zero is flagged and
 * Confirm is held while any is (FR-436) — the table is advisory, though: the
 * database refuses the write if the STORED balance would end below zero, and
 * the server's answer is the truth the table is checked against (SC-412).
 * While the amount box is blank or half-typed the table previews no change,
 * so a person mid-keystroke is never shown a refusal.
 *
 * **Validation is the action's own schema** (`adjustStarsSchema`), run before
 * the network so a refusal the server would give lands against its field —
 * nobody chosen, a blank, 0, a fraction, a number past ±500 — and the two
 * layers cannot disagree. The server's `P0004` comes back re-worded against
 * `amount`, naming the first Profile who would end below zero, and is shown at
 * the amount field with the sheet left open: a lost race is something the
 * person may answer again.
 *
 * The commit is the caller's: the board passes an `onSubmit` that wraps
 * `adjustStars` in `withActor(...)`, so punch-in happens at the moment of the
 * write and may answer `null` when the sheet was dismissed. Who may give is
 * the server's decision (FR-435); this sheet only shows what it says. A
 * success closes the sheet and the refetch repaints the columns — nothing is
 * written to the cache by hand (FR-441).
 */

/** What `adjustStars` takes (contracts §Giving stars): the chosen Profiles and one whole amount. */
export interface GiveStarsInput {
  categoryIds: string[];
  amount: number;
}

export interface GiveStarsSheetProps {
  /** The household's Profiles, in its order. A Label among them is never offered (FR-414). */
  profiles: readonly Category[];
  /** The view's rows keyed by Profile (R402) — the table's arithmetic; a Profile with no row reads 0. */
  balances: ReadonlyMap<string, number>;
  /** The commit — the board routes it through `withActor(...)` to `adjustStars`; tests drive a mock. */
  onSubmit: (input: GiveStarsInput) => Promise<SubmitOutcome>;
  onClose: () => void;
}

const LEGEND = "text-(length:--fam-fs-small) text-(--fam-text-muted)";
const NOTE = "text-(length:--fam-fs-small) text-(--fam-text-secondary)";
const BUTTON = "min-h-(--fam-touch) rounded-full px-5 text-(length:--fam-fs-body) font-medium";
const CELL = "px-3 py-2 text-(length:--fam-fs-body) tabular-nums";
const HEAD_CELL = "px-3 py-2 text-left text-(length:--fam-fs-small) font-medium text-(--fam-text-muted)";

/** FR-436's bound, and FR-434's one thing that is right but not obvious, beside the field. */
const AMOUNT_GUIDANCE = "A whole number from -500 to 500. A negative number takes stars away.";

/** The table's stand-in until there is a row to draw. */
const NO_ROWS = "Choose a Profile to see the change.";

/** What a flagged row says, beside the number (FR-436). */
const BELOW_ZERO = "Below zero";

/* ------------------------------------------------------------------ model -- */

/**
 * The amount as the schema will judge it. A blank box yields `NaN`, which
 * `adjustStarsSchema` refuses against its own field rather than being quietly
 * read as 0 — which the schema refuses too (FR-436).
 */
function amountOf(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

/** The amount the table previews: the whole number typed, or no change while the box is blank or half-typed. */
function previewAmountOf(text: string): number {
  const amount = amountOf(text);
  return Number.isInteger(amount) ? amount : 0;
}

/** The chosen ids in the household's order — the order sent, and the table's (FR-434). */
function orderedIdsOf(profiles: readonly Category[], selectedIds: readonly string[]): string[] {
  return profiles.filter((profile) => selectedIds.includes(profile.id)).map((profile) => profile.id);
}

interface UseGiveStarsOptions {
  /** Profiles only — the sheet has already dropped any Label (FR-414). */
  profiles: readonly Category[];
  balances: ReadonlyMap<string, number>;
  onSubmit: GiveStarsSheetProps["onSubmit"];
  onClose: () => void;
}

interface GiveStarsState {
  selectedIds: string[];
  amountText: string;
  /** `beforeAndAfterOf` over the chosen Profiles, in the household's order (FR-434). */
  table: BeforeAndAfter;
  toggleProfile: (id: string) => void;
  setAmountText: (value: string) => void;
  errors: FieldErrors;
  message: string | null;
  pending: boolean;
  submit: () => Promise<void>;
}

/** Validate locally with the action's own schema, then hand the parsed input to the caller. */
function validateAndSubmit(
  orderedIds: string[],
  amountText: string,
  onSubmit: GiveStarsSheetProps["onSubmit"],
): Promise<Settled> {
  return settleSubmit(
    () => parseOrThrow(adjustStarsSchema, { categoryIds: orderedIds, amount: amountOf(amountText) }),
    onSubmit,
  );
}

/**
 * The sheet's draft — who and how many — and the submit machinery every
 * `/family` form shares (`formSubmit`), so a refusal is shown here the way the
 * reward form shows one.
 */
function useGiveStars(options: UseGiveStarsOptions): GiveStarsState {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amountText, setAmountText] = useState("");
  const submission = useSubmission(options.onClose);

  const orderedIds = useMemo(
    () => orderedIdsOf(options.profiles, selectedIds),
    [options.profiles, selectedIds],
  );
  const table = useMemo(
    () => beforeAndAfterOf(options.balances, orderedIds, previewAmountOf(amountText)),
    [options.balances, orderedIds, amountText],
  );

  return {
    selectedIds,
    amountText,
    table,
    toggleProfile: (id) => setSelectedIds((current) => toggled(current, id)),
    setAmountText,
    errors: submission.errors,
    message: submission.message,
    pending: submission.pending,
    submit: () =>
      submission.submit(() => validateAndSubmit(orderedIds, amountText, options.onSubmit)),
  };
}

/* ------------------------------------------------------------------- view -- */

/** FR-434's amount: one whole number, negative to take away, with FR-436's bound beside it. */
function AmountField({ form }: { form: GiveStarsState }) {
  const helpId = useId();
  return (
    <div data-field="amount" className="flex flex-col gap-1">
      <label className={LABEL}>
        Stars
        <input
          type="number"
          min={-500}
          max={500}
          step={1}
          value={form.amountText}
          onChange={(event) => form.setAmountText(event.target.value)}
          aria-describedby={helpId}
          className={FIELD}
        />
      </label>
      <p id={helpId} className={NOTE}>
        {AMOUNT_GUIDANCE}
      </p>
      <FieldError messages={form.errors.amount} />
    </div>
  );
}

/** A Profile's name for a table row; the id when the Profile has left the household underneath the sheet. */
function nameOf(profiles: readonly Category[], categoryId: string): string {
  return profiles.find((profile) => profile.id === categoryId)?.label ?? categoryId;
}

/** One Profile's row: the name, the balance now, the balance after — flagged when after is below zero. */
function BalanceRow({ row, name }: { row: BalanceChange; name: string }) {
  const tone = row.belowZero ? "text-(--fam-danger)" : "";
  return (
    <tr data-below-zero={row.belowZero ? "true" : "false"} className={tone}>
      <td className={`${CELL} font-medium`}>{name}</td>
      <td className={CELL}>{row.before}</td>
      <td className={CELL}>
        <span data-after>{row.after}</span>
        {row.belowZero ? (
          <span className="ml-2 text-(length:--fam-fs-small)">{BELOW_ZERO}</span>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * FR-434's before-and-after table — one row per chosen Profile, in the
 * household's order, from the balances the tab holds and nothing counted
 * here (R402). A row that would end below zero says so (FR-436).
 */
function BeforeAndAfterTable({
  table,
  profiles,
}: {
  table: BeforeAndAfter;
  profiles: readonly Category[];
}) {
  if (table.rows.length === 0) return <p className={NOTE}>{NO_ROWS}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-(--fam-hairline)">
      <table aria-label="Before and after" className="w-full">
        <thead>
          <tr>
            <th scope="col" className={HEAD_CELL}>
              Profile
            </th>
            <th scope="col" className={HEAD_CELL}>
              Before
            </th>
            <th scope="col" className={HEAD_CELL}>
              After
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <BalanceRow key={row.categoryId} row={row} name={nameOf(profiles, row.categoryId)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * How the sheet ends: the line a refusal with no field lands on, then Cancel
 * and Confirm. Confirm is held while any row would end below zero (FR-436) and
 * while a submit is pending, so a double tap cannot give the same stars twice.
 */
function SheetFooter({ form, onClose }: { form: GiveStarsState; onClose: () => void }) {
  const anchored = Object.keys(form.errors).length > 0;
  return (
    <>
      <p role="alert" className="empty:hidden text-(length:--fam-fs-body) text-(--fam-text-primary)">
        {anchored ? null : form.message}
      </p>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={`${BUTTON} border border-(--fam-hairline)`}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={form.pending || form.table.anyBelowZero}
          className={`${BUTTON} bg-(--fam-primary-blue) text-white disabled:opacity-60`}
        >
          Confirm
        </button>
      </div>
    </>
  );
}

export function GiveStarsSheet({ profiles, balances, onSubmit, onClose }: GiveStarsSheetProps) {
  const dialogRef = useModalDialog(true, true);

  // FR-414: a Label is never given stars, whatever the caller passed.
  const people = useMemo(() => profiles.filter((profile) => profile.isProfile), [profiles]);

  const form = useGiveStars({ profiles: people, balances, onSubmit, onClose });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await form.submit();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="give-stars-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="give-stars-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        Give stars
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {/* FR-434: one or more Profiles; the refusal for none is the picker's own. */}
        <fieldset className="flex flex-col gap-1">
          <legend className={LEGEND}>Profiles</legend>
          <ProfileMultiSelect
            profiles={people}
            selectedIds={form.selectedIds}
            onToggle={form.toggleProfile}
          />
          <FieldError messages={form.errors.categoryIds} />
        </fieldset>

        <AmountField form={form} />

        <BeforeAndAfterTable table={form.table} profiles={people} />

        <SheetFooter form={form} onClose={onClose} />
      </form>
    </dialog>
  );
}
