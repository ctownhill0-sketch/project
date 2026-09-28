import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "destructive" | "neutral";

const STATUSES = {
  on_track: { label: "On track", tone: "success", icon: Icons.success },
  met: { label: "Met", tone: "success", icon: Icons.success },
  at_risk: { label: "At risk", tone: "warning", icon: Icons.warning },
  missed: { label: "Missed", tone: "destructive", icon: Icons.error },
  excluded: { label: "Excluded", tone: "neutral", icon: Icons.excluded },
  do_not_call: { label: "Do not call", tone: "destructive", icon: Icons.excluded },
} as const satisfies Record<string, { label: string; tone: Tone; icon: unknown }>;

export type Status = keyof typeof STATUSES;

const TONE_CLASS: Record<Tone, string> = {
  success: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  destructive: "border-destructive/40 text-destructive-text",
  neutral: "border-input text-muted-foreground",
};

/** Status is never color alone: icon + label + color together (brief 8.2). */
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { label, tone, icon: Icon } = STATUSES[status];
  return (
    <Badge variant="outline" data-tone={tone} className={cn("bg-card gap-1", TONE_CLASS[tone], className)}>
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}
