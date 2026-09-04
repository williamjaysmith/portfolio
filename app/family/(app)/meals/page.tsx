import type { Metadata } from "next";

import { Placeholder } from "../components/Placeholder";

export const metadata: Metadata = { title: "Meals" };

/** Placeholder until the Meals phase (FR-029). */
export default function MealsPage() {
  return <Placeholder tab="meals" />;
}
