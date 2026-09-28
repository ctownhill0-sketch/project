import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  DialogDemo,
  MenuDemo,
  PageErrorDemo,
  PopoverDemo,
  SelectDemo,
  TabsDemo,
  ToastDemo,
  TooltipDemo,
} from "@/components/design/demos";
import { Icons, type IconName } from "@/components/icons";
import { Num } from "@/components/num";
import { navLabel } from "@/components/shell/nav-items";
import { DisabledReason } from "@/components/states/disabled-reason";
import { EmptyState } from "@/components/states/empty-state";
import { Estimated } from "@/components/states/estimated";
import { StatusBadge } from "@/components/states/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contrastRatio } from "@/lib/design/contrast";
import { durations, easings, radii, shadows, themes, typeScale, type TokenName } from "@/lib/design/tokens";

export const metadata: Metadata = { title: navLabel("/design") };

/** Which surface each token is read against, so the table shows the ratio that matters. */
const CONTRAST_AGAINST: Partial<Record<TokenName, TokenName>> = {
  foreground: "background",
  "card-foreground": "card",
  "muted-foreground": "background",
  link: "background",
  // Status text only sits on surfaces (StatusBadge carries its own card fill).
  success: "card",
  warning: "card",
  destructive: "card",
  info: "card",
  "primary-foreground": "primary",
  "accent-foreground": "accent",
  input: "background",
  ring: "background",
  "chart-1": "card",
  "chart-2": "card",
  "chart-3": "card",
  "chart-4": "card",
  "chart-5": "card",
};

const SHOWN_TOKENS: TokenName[] = [
  "background",
  "card",
  "popover",
  "muted",
  "foreground",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "accent",
  "accent-foreground",
  "link",
  "success",
  "warning",
  "destructive",
  "info",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

function ratio(token: TokenName, theme: "light" | "dark") {
  const against = CONTRAST_AGAINST[token];
  if (!against) return "Surface";
  return `${contrastRatio(themes[theme][token], themes[theme][against]).toFixed(2)}:1`;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `section-${slug(title)}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <h2 id={id} className="text-h2 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-h3 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export default function DesignPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold">Design system</h1>
        <p className="text-muted-foreground max-w-[80ch]">
          The tokens, components and states every screen uses. Values come from lib/design/tokens.ts and are
          checked by tests; the full rules are in docs/design-contract.md.
        </p>
      </div>

      <Section title="Design language">
        <Card>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:gap-10">
            <div className="flex flex-col">
              <span className="text-small text-muted-foreground">After-hours median reply</span>
              <span className="text-display text-foreground font-semibold">
                <Num value={252} /> min
              </span>
            </div>
            <p className="text-muted-foreground max-w-[60ch]">
              A calm operations console in graphite and indigo. The one memorable element is large, tabular
              numbers. Indigo marks the one primary action, links, selection and focus.
            </p>
          </CardContent>
        </Card>
        <ul className="text-foreground grid max-w-[80ch] list-disc gap-2 pl-5">
          <li>Status is always an icon, a label and a color together.</li>
          <li>One primary action per view. Sentence case everywhere.</li>
          <li>A button&apos;s verb matches its toast. Errors say what happened and how to fix it.</li>
          <li>Nothing used a hundred times a day animates.</li>
        </ul>
      </Section>

      <Section title="Foundations">
        <Sub title="Color">
          <Table aria-label="Color tokens">
            <TableCaption>Contrast is measured against the surface each token sits on.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Light</TableHead>
                <TableHead className="text-right">Contrast</TableHead>
                <TableHead>Dark</TableHead>
                <TableHead className="text-right">Contrast</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SHOWN_TOKENS.map((token) => (
                <TableRow key={token}>
                  <TableCell className="font-medium">{token}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="border-input size-5 rounded-md border"
                        style={{ background: themes.light[token] }}
                      />
                      <span className="num">{themes.light[token]}</span>
                    </span>
                  </TableCell>
                  <TableCell className="num text-right">{ratio(token, "light")}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="border-input size-5 rounded-md border"
                        style={{ background: themes.dark[token] }}
                      />
                      <span className="num">{themes.dark[token]}</span>
                    </span>
                  </TableCell>
                  <TableCell className="num text-right">{ratio(token, "dark")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Sub>

        <Sub title="Typography">
          <Table aria-label="Type scale">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Size/line (px)</TableHead>
                <TableHead>Sample</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typeScale.map((t) => (
                <TableRow key={t.name}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell className="num text-right">
                    {t.size}/{t.line}
                  </TableCell>
                  <TableCell
                    style={{ fontSize: t.size, lineHeight: `${t.line}px` }}
                    className="whitespace-nowrap"
                  >
                    <Num value={1284} /> leads
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-muted-foreground">Inter 400, 500 and 600. Every number uses tabular figures.</p>
        </Sub>

        <Sub title="Spacing, radius and shadow">
          <div className="flex flex-wrap items-end gap-2" aria-label="Spacing steps">
            {[1, 2, 3, 4, 6, 8, 12, 16].map((step) => (
              <div key={step} className="flex flex-col items-center gap-1">
                <span
                  aria-hidden="true"
                  className="bg-accent block"
                  style={{ width: step * 4, height: step * 4 }}
                />
                <Num value={step * 4} className="text-caption text-muted-foreground" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(shadows) as (keyof typeof shadows)[]).map((name, i) => (
              <div
                key={name}
                className="bg-card flex h-24 flex-col justify-end p-4"
                style={{ boxShadow: shadows[name], borderRadius: Object.values(radii)[i] }}
              >
                <span className="font-medium">shadow-{name}</span>
                <span className="text-small text-muted-foreground">
                  {["Controls", "Cards and popovers", "Modals only"][i]}, radius{" "}
                  <Num value={Object.values(radii)[i] ?? 0} />
                </span>
              </div>
            ))}
          </div>
        </Sub>

        <Sub title="Motion">
          <Table aria-label="Motion tokens">
            <TableHeader>
              <TableRow>
                <TableHead>Use</TableHead>
                <TableHead className="text-right">Duration (ms)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(durations).map(([use, ms]) => (
                <TableRow key={use}>
                  <TableCell>{use}</TableCell>
                  <TableCell className="num text-right">{ms}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-muted-foreground">
            Easing out {easings.out}, in-out {easings.inOut}, drawers {easings.drawer}. No animation on
            hotkeys, dispositions, tabs or row moves. Reduced motion keeps short fades only.
          </p>
        </Sub>

        <Sub title="Icons">
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {(Object.keys(Icons) as IconName[]).map((name) => {
              const Icon = Icons[name];
              return (
                <li key={name} className="text-small flex items-center gap-2">
                  <Icon className="size-4" />
                  {name}
                </li>
              );
            })}
          </ul>
        </Sub>
      </Section>

      <Section title="Components">
        <Sub title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary action</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button disabled>Disabled</Button>
            <Button disabled>
              <Spinner data-icon="inline-start" />
              Saving…
            </Button>
          </div>
          <p className="text-muted-foreground">
            Hover darkens the fill; focus shows a 2px outline; pressing scales to 0.97. Loading uses a spinner
            and disabled, never an isLoading prop.
          </p>
        </Sub>

        <Sub title="Badges and status">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="on_track" />
            <StatusBadge status="at_risk" />
            <StatusBadge status="met" />
            <StatusBadge status="missed" />
            <StatusBadge status="excluded" />
            <Badge variant="outline">Tag: Brooklyn</Badge>
          </div>
        </Sub>

        <Sub title="Form fields">
          <FieldGroup className="max-w-md">
            <Field>
              <FieldLabel htmlFor="design-firm">Firm name</FieldLabel>
              <Input id="design-firm" defaultValue="Harborline Residential" />
              <FieldDescription>As it appears on the firm&apos;s website.</FieldDescription>
            </Field>
            <Field data-invalid>
              <FieldLabel htmlFor="design-units">Units</FieldLabel>
              <Input id="design-units" defaultValue="-4" aria-invalid aria-describedby="design-units-error" />
              <FieldError id="design-units-error">Units must be 0 or more.</FieldError>
            </Field>
            <Field data-disabled>
              <FieldLabel htmlFor="design-domain">Domain</FieldLabel>
              <Input id="design-domain" defaultValue="harborline-residential.example" disabled />
              <FieldDescription>Set by the import. Edit it on the lead page.</FieldDescription>
            </Field>
          </FieldGroup>
          <div className="flex flex-wrap items-center gap-3">
            <SelectDemo />
            <TooltipDemo />
            <PopoverDemo />
            <MenuDemo />
            <DialogDemo />
          </div>
        </Sub>

        <Sub title="Tabs">
          <TabsDemo />
        </Sub>

        <Sub title="Tables">
          <Table aria-label="Example lead list">
            <TableHeader>
              <TableRow>
                <TableHead>Firm</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Median reply (min)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Harborline Residential</TableCell>
                <TableCell className="text-right">
                  <Num value={85} />
                </TableCell>
                <TableCell className="text-right">
                  <Num value={252} />
                </TableCell>
                <TableCell>
                  <StatusBadge status="on_track" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Quarry Oak Property Group</TableCell>
                <TableCell className="text-right">
                  <Num value={0} />
                </TableCell>
                <TableCell className="text-right">
                  <Num value={null} />
                </TableCell>
                <TableCell>
                  <StatusBadge status="excluded" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Sub>

        <Sub title="Keyboard hints and separators">
          <p className="text-muted-foreground flex items-center gap-2">
            Log a disposition with <Kbd>1</Kbd>–<Kbd>9</Kbd>.
          </p>
          <Separator />
        </Sub>
      </Section>

      <Section title="Six states">
        <div className="grid gap-8 md:grid-cols-2">
          <Sub title="Loading">
            <div className="flex flex-col gap-2" aria-label="Loading example" role="status">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </Sub>
          <Sub title="Empty">
            <EmptyState
              title="No mystery shops yet"
              sentence="Log your first shop to start measuring reply times."
              action={{ label: "Log a shop", href: "/shops" }}
            />
          </Sub>
          <Sub title="Error">
            <PageErrorDemo />
          </Sub>
          <Sub title="Success">
            <p className="text-muted-foreground">A toast repeats the action&apos;s verb.</p>
            <ToastDemo />
          </Sub>
          <Sub title="Disabled">
            <DisabledReason reason="Add at least one mystery shop to this firm first.">
              {(props) => (
                <Button variant="outline" {...props}>
                  Download audit PDF
                </Button>
              )}
            </DisabledReason>
          </Sub>
          <Sub title="Partial">
            <p>
              <Estimated>
                <span>
                  <Num value={120} /> units
                </span>
              </Estimated>
            </p>
          </Sub>
        </div>
      </Section>

      <Section title="Maintenance">
        <Card>
          <CardHeader>
            <CardTitle>Adding or changing components</CardTitle>
            <CardDescription>Keep the system honest as it grows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p>
              Add a shadcn component with <code className="bg-muted rounded-sm px-1">pnpm ui:add name</code>,
              then run <code className="bg-muted rounded-sm px-1">pnpm ui:normalize</code> to strip banned
              classes.
            </p>
            <p>
              Change a color only in lib/design/tokens.ts and mirror it in app/globals.css; tests fail
              otherwise.
            </p>
            <p>
              At each checkpoint: screenshots at 320, 768 and 1440 in both themes, axe, and one decoration
              removed.
            </p>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
