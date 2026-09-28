import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

interface EmptyStateProps {
  title: string;
  /** One sentence explaining what goes here. */
  sentence: string;
  /** Exactly one action. */
  action: { label: string; href: string };
}

export function EmptyState({ title, sentence, action }: EmptyStateProps) {
  return (
    <Empty className="bg-card">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{sentence}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {/* Navigation is a real link, styled like a button. */}
        <Link href={action.href} className={cn(buttonVariants({ variant: "outline" }))}>
          {action.label}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
