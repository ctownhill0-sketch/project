import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { navLabel } from "@/components/shell/nav-items";

export const metadata: Metadata = { title: navLabel("/settings") };

export default function SettingsPage() {
  return <ModulePlaceholder href="/settings" />;
}
