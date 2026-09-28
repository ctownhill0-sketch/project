import { Icons } from "@/components/icons";
import { Num } from "@/components/num";
import { Progress } from "@/components/ui/progress";
import { formatMinutes } from "@/lib/domain/scoring";
import type { DashboardData } from "@/lib/queries/dashboard";

function Meter({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span>
          <Num value={value} className="font-semibold" />{" "}
          <span className="text-muted-foreground">
            of <Num value={target} />
          </span>
        </span>
      </div>
      <Progress value={pct} aria-label={`${label}: ${value} of ${target}`} />
    </div>
  );
}

/** Day-90 kill test: countdown, pilots, conversations, after-hours median vs threshold. */
export function KillTest({ kill }: { kill: DashboardData["killTest"] }) {
  const median = kill.afterHoursMedianMinutes;
  const medianText =
    median === null ? "unknown" : Number.isFinite(median) ? formatMinutes(median) : "No reply";
  return (
    <section aria-labelledby="kill-test" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="kill-test" className="font-semibold">
          Day-90 kill test
        </h2>
        <span className="text-small text-muted-foreground">
          {kill.started ? (
            <>
              Day <Num value={kill.day} /> of <Num value={kill.totalDays} />
            </>
          ) : (
            <>
              Starts in <Num value={kill.startsInDays} /> day{kill.startsInDays === 1 ? "" : "s"}
            </>
          )}
        </span>
      </div>
      <Meter label="Paid pilots" value={kill.pilots} target={kill.targets.pilotsTarget} />
      <Meter
        label="Decision-maker conversations"
        value={kill.conversations}
        target={kill.targets.conversationsTarget}
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span>After-hours median reply</span>
          <span className="num font-semibold">{medianText}</span>
        </div>
        <p className="text-small flex items-center gap-1.5">
          {kill.afterHoursMet === null ? (
            <span className="text-muted-foreground">No after-hours shops yet.</span>
          ) : kill.afterHoursMet ? (
            <>
              <Icons.success className="text-success size-4" />
              <span>Above the {kill.targets.afterHoursMedianMinutes} min threshold</span>
            </>
          ) : (
            <>
              <Icons.warning className="text-warning size-4" />
              <span>Not above {kill.targets.afterHoursMedianMinutes} min yet</span>
            </>
          )}
          <span className="text-muted-foreground">
            (<Num value={kill.afterHoursShops} /> shops)
          </span>
        </p>
      </div>
    </section>
  );
}
