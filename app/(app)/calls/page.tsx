import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { navLabel } from "@/components/shell/nav-items";

export const metadata: Metadata = { title: navLabel("/calls") };

export default function CallsPage() {
  return <ModulePlaceholder href="/calls" />;
}
