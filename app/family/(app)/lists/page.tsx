import type { Metadata } from "next";

import { Placeholder } from "../components/Placeholder";

export const metadata: Metadata = { title: "Lists" };

/** Placeholder until the Lists phase (FR-029). */
export default function ListsPage() {
  return <Placeholder tab="lists" />;
}
