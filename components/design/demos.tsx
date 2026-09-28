"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageError } from "@/components/states/page-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Success: the toast repeats the button's verb (brief 8.7). */
export function ToastDemo() {
  return (
    <Button onClick={() => toast.success("Lead saved")} className="self-start">
      Save lead
    </Button>
  );
}

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete demo data?</DialogTitle>
          <DialogDescription>
            This removes the fictional firms, shops and calls. Your settings stay. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep demo data</DialogClose>
          <DialogClose
            render={<Button variant="destructive" />}
            onClick={() => toast("Demo only: nothing was deleted")}
          >
            Delete demo data
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>Move to…</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Pipeline stage</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => toast("Moved to Conversation")}>Conversation</DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast("Moved to Audit sent")}>Audit sent</DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast("Moved to Pilot proposed")}>Pilot proposed</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>Score breakdown</PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Score 85</PopoverTitle>
          <PopoverDescription>
            Not on AppFolio +30, no software +20, slow reply +25, local +10.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

export function TooltipDemo() {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" />}>After-hours</TooltipTrigger>
      <TooltipContent>Weeknights, Sundays and federal holidays, New York time.</TooltipContent>
    </Tooltip>
  );
}

const METROS = [
  { value: "nyc", label: "New York metro" },
  { value: "all", label: "All metros" },
];

export function SelectDemo() {
  return (
    <Select items={METROS} defaultValue="nyc">
      <SelectTrigger aria-label="Metro" className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {METROS.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TabsDemo() {
  return (
    <Tabs defaultValue="business">
      <TabsList>
        <TabsTrigger value="business">Business hours</TabsTrigger>
        <TabsTrigger value="saturday">Saturday</TabsTrigger>
        <TabsTrigger value="after">After-hours</TabsTrigger>
      </TabsList>
      <TabsContent value="business" className="text-muted-foreground pt-3">
        Mon–Fri 09:00–17:00.
      </TabsContent>
      <TabsContent value="saturday" className="text-muted-foreground pt-3">
        All of Saturday.
      </TabsContent>
      <TabsContent value="after" className="text-muted-foreground pt-3">
        Weeknights, Sundays and federal holidays.
      </TabsContent>
    </Tabs>
  );
}

export function PageErrorDemo() {
  const [attempts, setAttempts] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      <PageError
        what="Couldn't load leads"
        fix="Check that pnpm dev is still running in Terminal, then retry."
        onRetry={() => {
          setAttempts((n) => n + 1);
          toast("Retried loading leads");
        }}
      />
      <p aria-live="polite" className="text-small text-muted-foreground">
        {attempts > 0 ? `Retried ${attempts} time${attempts === 1 ? "" : "s"}.` : ""}
      </p>
    </div>
  );
}
