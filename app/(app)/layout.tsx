import Link from "next/link";
import { MenuDrawer } from "@/components/shell/menu-drawer";
import { NavList } from "@/components/shell/nav-list";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";

const PHONE_BAR_ITEMS = NAV_ITEMS.filter((item) => item.onPhoneBar);

/**
 * Shell: sidebar ≥1024px, drawer 768–1023px, bottom bar <768px (brief 8.4).
 * Only one navigation is displayed at a time; the others are display:none.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#main"
        className="bg-card text-foreground sr-only rounded-lg px-4 py-2 shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="border-border bg-card hidden w-60 shrink-0 flex-col gap-6 border-r px-3 py-5 lg:flex">
        <Link href="/dashboard" className="text-h3 text-foreground px-3 font-semibold">
          Vacancy Desk
        </Link>
        <nav aria-label="Main">
          <NavList items={NAV_ITEMS} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-card flex h-14 items-center gap-2 border-b px-4">
          <div className="hidden md:block lg:hidden">
            <MenuDrawer variant="header" />
          </div>
          <Link href="/dashboard" className="text-foreground font-semibold lg:hidden">
            Vacancy Desk
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 pb-24 outline-none md:px-8 md:pb-8">
          {children}
        </main>
      </div>

      <nav
        aria-label="Quick"
        className="border-border bg-card fixed inset-x-0 bottom-0 grid grid-cols-4 border-t px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <div className="col-span-3">
          <NavList items={PHONE_BAR_ITEMS} layout="bar" />
        </div>
        <MenuDrawer variant="bar" />
      </nav>
    </div>
  );
}
