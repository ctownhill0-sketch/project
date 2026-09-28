import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { navLabel } from "@/components/shell/nav-items";

export const metadata: Metadata = { title: navLabel("/pilots") };

export default function PilotsPage() {
  return <ModulePlaceholder href="/pilots" />;
}
