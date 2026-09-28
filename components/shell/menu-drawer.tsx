"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";
import { NavList } from "@/components/shell/nav-list";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Tablet and phone navigation: a titled drawer that traps focus and closes on Escape. */
export function MenuDrawer({ variant }: { variant: "header" | "bar" }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          variant === "header" ? (
            <Button variant="ghost" size="lg" />
          ) : (
            <button
              type="button"
              className="text-caption text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 font-medium"
            />
          )
        }
      >
        <Icons.menu className={variant === "bar" ? "size-5" : "size-4"} />
        Menu
      </SheetTrigger>
      <SheetContent side="left" className="w-72 duration-(--duration-dialog) ease-(--ease-drawer)">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Menu" className="px-3 pb-4">
          <NavList items={NAV_ITEMS} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
