"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { replyAction } from "@/app/(app)/shops/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** "Replied now" (one tap), or an earlier reply time. The reply type matters for the pilot pitch. */
export function ReplyButtons({ shopId, firmName }: { shopId: string; firmName: string }) {
  const [type, setType] = useState<"human" | "auto" | "ai">("human");
  const [earlier, setEarlier] = useState(false);
  const [when, setWhen] = useState("");
  const [pending, start] = useTransition();
  const save = (repliedAt?: string) =>
    start(async () => {
      const res = await replyAction({ shopId, replyType: type, ...(repliedAt ? { repliedAt } : {}) });
      if (res.ok) toast.success(`Reply from ${firmName} recorded`);
      else toast.error(res.error);
    });
  const typeId = `reply-type-${shopId}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={typeId} className="sr-only">
        Reply type for {firmName}
      </Label>
      <select
        id={typeId}
        value={type}
        onChange={(e) => setType(e.target.value as typeof type)}
        className="border-input bg-card h-8 rounded-lg border px-2 text-sm"
      >
        <option value="human">A person</option>
        <option value="auto">Auto-reply</option>
        <option value="ai">AI assistant</option>
      </select>
      <Button size="sm" disabled={pending} onClick={() => save()} aria-label={`Replied now: ${firmName}`}>
        Replied now
      </Button>
      {earlier ? (
        <>
          <Label htmlFor={`reply-at-${shopId}`} className="sr-only">
            Reply time for {firmName}
          </Label>
          <Input
            id={`reply-at-${shopId}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-8 w-52"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !when}
            onClick={() => save(new Date(when).toISOString())}
          >
            Save time
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setEarlier(true)}>
          Earlier…
        </Button>
      )}
    </div>
  );
}
