import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { MenuDrawer } from "@/components/shell/menu-drawer";
import { NavList } from "@/components/shell/nav-list";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { NotificationBell } from "@/components/shell/notification-bell";
import { PageCrumb } from "@/components/shell/page-crumb";
import { SearchTrigger } from "@/components/shell/search-trigger";
import { ShellProvider } from "@/components/shell/shell-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth/require-user";
import { getDb } from "@/lib/db";
import { company, pilot } from "@/lib/db/schema";
import { getNotifications } from "@/lib/queries/notifications";

const PHONE_BAR_ITEMS = NAV_ITEMS.filter((item) => item.onPhoneBar);

/**
 * Shell (Direction C): grouped sidebar ≥1024px, drawer 768–1023px, bottom bar <768px.
 * Only one navigation is displayed at a time; the others are display:none.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { workspaceId } = await requireUser();
  const db = await getDb();
  const [[leads], [pilots], notifications] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(company)
      .where(eq(company.workspaceId, workspaceId)),
    db
      .select({ n: sql<number>`count(*) filter (where ${pilot.status} = 'running')::int` })
      .from(pilot)
      .where(eq(pilot.workspaceId, workspaceId)),
    getNotifications(db, workspaceId),
  ]);
  const counts = { "/leads": leads?.n ?? 0, "/pilots": pilots?.n ?? 0 };

  return (
    <ShellProvider>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <a
          href="#main"
          data-skip-link
          className="bg-card text-foreground sr-only rounded-lg px-4 py-2 shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>

        <aside className="border-border bg-card sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r px-3 py-4 lg:flex">
          <Link href="/dashboard" className="text-foreground flex items-center gap-2 px-2 font-semibold">
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground text-caption grid size-6 place-items-center rounded-md"
            >
              VD
            </span>
            Vacancy Desk
          </Link>
          <SearchTrigger />
          <nav aria-label="Main">
            <NavList items={NAV_ITEMS} grouped counts={counts} />
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-border bg-card sticky top-0 flex h-14 items-center gap-2 border-b px-4">
            <div className="hidden md:block lg:hidden">
              <MenuDrawer variant="header" />
            </div>
            <PageCrumb />
            <div className="ml-auto flex items-center gap-1">
              <div className="lg:hidden">
                <SearchTrigger variant="icon" />
              </div>
              <NotificationBell total={notifications.total} items={notifications.items} />
              <ThemeToggle />
            </div>
          </header>

          <main id="main" tabIndex={-1} className="flex-1 px-4 py-5 pb-24 outline-none md:px-8 md:pb-8">
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
    </ShellProvider>
  );
}
