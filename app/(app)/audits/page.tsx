import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { navLabel } from "@/components/shell/nav-items";

export const metadata: Metadata = { title: navLabel("/audits") };

export default function AuditsPage() {
  return <ModulePlaceholder href="/audits" />;
}
