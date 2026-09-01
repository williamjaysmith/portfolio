import { redirect } from "next/navigation";

/** The app opens on the Calendar tab (FR-030). */
export default function FamilyIndexPage() {
  redirect("/family/calendar");
}
