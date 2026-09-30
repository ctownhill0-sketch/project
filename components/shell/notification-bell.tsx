"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface BellItem {
  kind: string;
  name: string;
  label: string;
  href: string;
}

/** Due reply checks and callbacks, call-now leads, finder results and pilots at risk. */
export function NotificationBell({ total, items }: { total: number; items: BellItem[] }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="lg"
            aria-label={total ? `Notifications, ${total} due` : "Notifications, none due"}
          />
        }
      >
        <Icons.bell />
        {total ? <span className="num">{total}</span> : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Due now</PopoverTitle>
          <PopoverDescription>
            {total
              ? "Callbacks, reply checks, leads to call now, finder results and pilots at risk."
              : "Nothing is due. Callbacks, reply checks and new finder results show here."}
          </PopoverDescription>
        </PopoverHeader>
        {items.length ? (
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={`${item.kind}-${item.href}-${item.label}`}>
                <Link href={item.href} className="hover:bg-muted flex flex-col rounded-md px-2 py-1.5">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-small text-muted-foreground">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
