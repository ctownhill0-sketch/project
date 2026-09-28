import { EmptyState } from "@/components/states/empty-state";
import { NAV_ITEMS } from "@/components/shell/nav-items";

/** Honest placeholder for a module that a later Free Build step builds. */
export function ModulePlaceholder({ href }: { href: string }) {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  const action =
    href === "/settings"
      ? { label: "Go to the dashboard", href: "/dashboard" }
      : { label: "Open settings", href: "/settings" };
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-h1 font-semibold">{item.label}</h1>
      <EmptyState
        title="Not built yet"
        sentence={`Built in step ${item.step} of the Free Build.`}
        action={action}
      />
    </div>
  );
}
