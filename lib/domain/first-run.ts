// First-run checklist on the dashboard (brief M17): the steps from demo data to a real routine.

export interface FirstRunFacts {
  shopperNameSet: boolean;
  placesKeySet: boolean;
  demoFirmsLeft: number;
  realLeads: number;
  realShops: number;
  realCalls: number;
  thisWeekEntered: boolean;
}

export const LEADS_GOAL = 25;
export const SHOPS_GOAL = 5;

export function firstRunChecklist(f: FirstRunFacts) {
  const items = [
    {
      key: "name",
      label: "Set your real name for mystery shops",
      href: "/settings#brand",
      done: f.shopperNameSet,
    },
    {
      key: "key",
      label: "Add your Google Places key (optional)",
      href: "/settings#places",
      done: f.placesKeySet,
    },
    { key: "demo", label: "Delete the demo data", href: "/settings#data", done: f.demoFirmsLeft === 0 },
    {
      key: "leads",
      label: `Find or import ${LEADS_GOAL} real leads`,
      href: "/finder",
      done: f.realLeads >= LEADS_GOAL,
      progress: `${Math.min(f.realLeads, LEADS_GOAL)} of ${LEADS_GOAL}`,
    },
    {
      key: "shops",
      label: `Send ${SHOPS_GOAL} mystery shops`,
      href: "/shops/plan",
      done: f.realShops >= SHOPS_GOAL,
      progress: `${Math.min(f.realShops, SHOPS_GOAL)} of ${SHOPS_GOAL}`,
    },
    { key: "calls", label: "Run your first call block", href: "/calls?mode=block", done: f.realCalls > 0 },
    { key: "week", label: "Enter this week's numbers", href: "/settings#weekly", done: f.thisWeekEntered },
  ];
  const done = items.filter((i) => i.done).length;
  return {
    items,
    done,
    total: items.length,
    complete: done === items.length,
    next: items.find((i) => !i.done) ?? null,
  };
}

export type FirstRun = ReturnType<typeof firstRunChecklist>;
