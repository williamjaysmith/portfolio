import type { ReactNode } from "react";

/** One labelled row of a details sheet — the event's and the task's alike. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <span className="block text-(length:--fam-fs-small) font-medium text-(--fam-text-secondary)">
        {label}
      </span>
      <div className="mt-1 text-(length:--fam-fs-body)">{children}</div>
    </div>
  );
}
