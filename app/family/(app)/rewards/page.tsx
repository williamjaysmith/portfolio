import type { Metadata } from "next";

import { Placeholder } from "../components/Placeholder";

export const metadata: Metadata = { title: "Rewards" };

/** Placeholder until the Rewards phase (FR-029). */
export default function RewardsPage() {
  return <Placeholder tab="rewards" />;
}
