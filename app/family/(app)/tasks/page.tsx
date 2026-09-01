import type { Metadata } from "next";

import { Placeholder } from "../components/Placeholder";

export const metadata: Metadata = { title: "Tasks" };

/** Placeholder until the Tasks phase (FR-029). */
export default function TasksPage() {
  return <Placeholder tab="tasks" />;
}
