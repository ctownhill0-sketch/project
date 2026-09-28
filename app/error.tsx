"use client";

import { PageError } from "@/components/states/page-error";

/** Catches failures in any page or layout: says what failed and how to fix it. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const needsSetup = /db:setup|No local owner/i.test(error.message);
  return (
    <main id="main" className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-h2 font-semibold">Vacancy Desk</h1>
      <PageError
        what={needsSetup ? "The local database isn't set up yet" : "This page couldn't load"}
        fix={
          needsSetup
            ? "In Terminal, run pnpm db:setup in the project folder, then retry."
            : "Check that pnpm dev is still running in Terminal, then retry."
        }
        onRetry={reset}
      />
    </main>
  );
}
