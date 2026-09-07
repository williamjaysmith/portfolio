import type { ReactNode } from "react";

/**
 * One labelled row of a details sheet — the event's and the task's alike.
 *
 * The value is a `group` labelled by its own caption, so it can be found by
 * that name rather than by walking the DOM from the label. It used to be two
 * unrelated pieces of text: readable in order, but with no programmatic
 * relationship at all, which left a screen reader to infer the pairing and
 * left a browser journey reaching for an XPath sibling selector. `007`'s
 * harness is explicit that a thing which cannot be found by role and name is a
 * defect in the application, and the fix is to name it.
 *
 * The id is derived from the label rather than from `useId`, so this stays a
 * Server Component. Labels are unique within a dialog, which is the only scope
 * that matters here.
 */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  const id = `detail-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="mt-3">
      <span
        id={id}
        className="block text-(length:--fam-fs-small) font-medium text-(--fam-text-secondary)"
      >
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="mt-1 text-(length:--fam-fs-body)">
        {children}
      </div>
    </div>
  );
}
