"use client";

/**
 * The one line under a board's chrome (003 FR-393, 004 FR-441, 005 FR-537): a
 * refusal in the server's own words, the read error in the household's, or
 * nothing. Shared by the Rewards and Lists boards (the gate caught the two
 * copies; this is the extraction).
 */
export function BoardNotice({ notice }: { notice: string | null }) {
  if (notice === null) return null;
  return (
    <p role="alert" className="px-(--fam-edge-inset) py-1 text-(length:--fam-fs-small) text-(--fam-danger)">
      {notice}
    </p>
  );
}
