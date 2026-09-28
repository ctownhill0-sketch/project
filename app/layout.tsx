import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Self-hosted Inter (SIL OFL) so builds work offline. Variable font covers 400/500/600.
const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "400 600",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vacancy Desk",
  description: "Command center for Vacancy Desk sales and pilots.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the head script before first paint, so React sees a different attribute.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {/* First tooltip waits 400ms; the provider opens later ones instantly (brief 8.6). */}
        <TooltipProvider delay={400}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
