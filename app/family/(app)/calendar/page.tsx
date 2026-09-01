import type { Metadata } from "next";

import { Placeholder } from "../components/Placeholder";

export const metadata: Metadata = { title: "Calendar" };

/** Placeholder until the Calendar phase (FR-029). */
export default function CalendarPage() {
  return <Placeholder tab="calendar" />;
}
