"use client";

import Link from "next/link";
import { useState, useTransition, type DragEvent } from "react";
import { toast } from "sonner";
import { moveDealAction, vacanciesAction } from "@/app/(app)/pipeline/actions";
import { Num } from "@/components/num";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { pipelineBoard } from "@/lib/queries/pipeline";
import { cn } from "@/lib/utils";

type Board = Awaited<ReturnType<typeof pipelineBoard>>;
type Stage = Board["stages"][number];
type Card = Stage["deals"][number];

const when = (d: Date | string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(
    new Date(d),
  );

function useMover() {
  const [pending, start] = useTransition();
  const [lost, setLost] = useState<{ card: Card; stageKey: string } | null>(null);
  const [reason, setReason] = useState("");
  const move = (card: Card, stage: Pick<Stage, "key" | "name" | "isLost">, lostReason?: string) => {
    if (stage.isLost && !lostReason) {
      setReason("");
      setLost({ card, stageKey: stage.key });
      return;
    }
    start(async () => {
      const res = await moveDealAction({
        dealId: card.id,
        stageKey: stage.key,
        lostReason: lostReason ?? null,
      });
      if (res.ok) toast.success(`${card.companyName} moved to ${stage.name}`);
      else toast.error(res.error);
    });
  };
  const dialog = (
    <Dialog open={lost !== null} onOpenChange={(open) => (open ? null : setLost(null))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why was {lost?.card.companyName} lost?</DialogTitle>
          <DialogDescription>A lost reason is required. It helps you spot patterns later.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!lost || !reason.trim()) return;
            move(lost.card, { key: lost.stageKey, name: "Lost", isLost: true }, reason.trim());
            setLost(null);
          }}
        >
          <Label htmlFor="lost-reason">Lost reason</Label>
          <Textarea
            id="lost-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            required
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLost(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!reason.trim()}>
              Mark lost
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
  return { move, pending, dialog };
}

function MoveMenu({
  card,
  stages,
  onMove,
  disabled,
}: {
  card: Card;
  stages: Stage[];
  onMove: (s: Stage) => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled}>
            Move to…<span className="sr-only"> ({card.companyName})</span>
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-52">
        {stages
          .filter((s) => s.id !== card.stageId)
          .map((s) => (
            <DropdownMenuItem key={s.id} onClick={() => onMove(s)}>
              {s.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Vacancies({ card }: { card: Card }) {
  const [value, setValue] = useState(String(card.vacancies));
  const [pending, start] = useTransition();
  const id = `vac-${card.id}`;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await vacanciesAction({ dealId: card.id, vacancies: value });
          if (res.ok) toast.success("Vacancies saved");
          else toast.error(res.error);
        });
      }}
    >
      <Label htmlFor={id} className="text-small">
        Vacancies
      </Label>
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        className="num h-8 w-16"
      />
      <Button size="sm" variant="ghost" type="submit" disabled={pending || value === String(card.vacancies)}>
        Save
      </Button>
    </form>
  );
}

function DealCard({
  card,
  stages,
  onMove,
  pending,
}: {
  card: Card;
  stages: Stage[];
  onMove: (s: Stage) => void;
  pending: boolean;
}) {
  return (
    <li
      draggable
      onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/deal-id", card.id)}
      className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-sm"
      aria-label={card.companyName}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/leads?lead=${card.companyId}`}
          className="font-medium underline-offset-2 hover:underline"
        >
          {card.companyName}
        </Link>
        <span className="text-small num">
          <Num value={card.expectedMrr} format="currency" />
        </span>
      </div>
      <p className="text-caption text-muted-foreground">
        {card.lostReason
          ? `Lost: ${card.lostReason}`
          : `${card.probability}% · ${card.daysInStage} days in stage · ${card.vacancies} vacancies`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <MoveMenu card={card} stages={stages} onMove={onMove} disabled={pending} />
        <details className="text-small">
          <summary className="cursor-pointer">History</summary>
          <ol className="flex flex-col gap-0.5 pt-1">
            {card.history.map((h, i) => (
              <li key={i}>
                {when(h.movedAt)}: {h.from ? `${h.from} → ` : ""}
                {h.to}
              </li>
            ))}
          </ol>
          {!card.closedAt ? <Vacancies card={card} /> : null}
        </details>
      </div>
    </li>
  );
}

/** Kanban: drag a card to a column, or use "Move to…" (every drag has a keyboard equivalent). */
export function PipelineBoard({ stages }: { stages: Stage[] }) {
  const { move, pending, dialog } = useMover();
  const [over, setOver] = useState<string | null>(null);
  const all = stages.flatMap((s) => s.deals);
  return (
    <>
      <div className="relative overflow-x-auto" role="region" aria-label="Pipeline board" tabIndex={0}>
        <div className="flex min-w-max gap-3 pb-2">
          {stages.map((stage) => (
            <section
              key={stage.id}
              aria-label={`${stage.name}, ${stage.deals.length} deals`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const card = all.find((c) => c.id === e.dataTransfer.getData("text/deal-id"));
                if (card && card.stageId !== stage.id) move(card, stage);
              }}
              className={cn(
                "bg-muted flex w-64 flex-col gap-2 rounded-xl p-2",
                over === stage.id && "outline-primary outline-2",
              )}
            >
              <header className="flex items-baseline justify-between px-1">
                <h2 className="text-small font-semibold">{stage.name}</h2>
                <span className="text-caption text-muted-foreground">
                  <Num value={stage.deals.length} /> · {stage.probability}%
                </span>
              </header>
              <ul className="flex flex-col gap-2">
                {stage.deals.map((card) => (
                  <DealCard
                    key={card.id}
                    card={card}
                    stages={stages}
                    pending={pending}
                    onMove={(s) => move(card, s)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      {dialog}
    </>
  );
}

export function PipelineTable({ stages }: { stages: Stage[] }) {
  const { move, pending, dialog } = useMover();
  const rows = stages.flatMap((s) => s.deals.map((d) => ({ ...d, stageName: s.name })));
  return (
    <>
      <div
        className="border-border bg-card relative overflow-x-auto rounded-xl border"
        role="region"
        aria-label="Pipeline table"
        tabIndex={0}
      >
        <table className="text-small w-full min-w-[720px]">
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Firm
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Stage
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Vacancies
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Probability
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Expected MRR
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Days in stage
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-border border-t">
                <td className="px-3 py-2">
                  <Link href={`/leads?lead=${r.companyId}`} className="underline-offset-2 hover:underline">
                    {r.companyName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {r.lostReason ? `${r.stageName}: ${r.lostReason}` : r.stageName}
                </td>
                <td className="px-3 py-2 text-right">
                  <Num value={r.vacancies} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Num value={r.probability / 100} format="percent" />
                </td>
                <td className="px-3 py-2 text-right">
                  <Num value={r.expectedMrr} format="currency" />
                </td>
                <td className="px-3 py-2 text-right">
                  <Num value={r.daysInStage} />
                </td>
                <td className="px-3 py-2">
                  <MoveMenu card={r} stages={stages} onMove={(s) => move(r, s)} disabled={pending} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </>
  );
}
