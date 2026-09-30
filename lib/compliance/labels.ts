// Display helpers shared by server and client fair-housing views.
import type { Outcome } from "@/lib/domain/fair-housing";

const CATEGORY: Record<string, string> = {
  familial_status: "Familial status",
  source_of_income: "Source of income",
  national_origin: "National origin",
  disability: "Disability",
  religion: "Religion",
  age: "Age",
};

export const categoryLabel = (c: string) =>
  CATEGORY[c] ?? c.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase());

export function checkStatus(c: { outcome: Outcome; overrideReason: string | null }) {
  if (c.outcome === "warn" && c.overrideReason) return "check_overridden" as const;
  return `check_${c.outcome}` as const;
}
