import type { Metadata } from "next";
import localFont from "next/font/local";
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
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
