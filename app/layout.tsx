import type { Metadata } from "next";
import type { ReactNode } from "react";
// Ember type, self-hosted through @fontsource (never a Google Fonts loader). Instrument Serif
// italic is the Editorial display; Bricolage Grotesque and Fredoka the Characterful and Playful.
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/fredoka/600.css";
import "./theme.css";
import "./globals.css";
import { LookProvider } from "@/components/looks/LookProvider";
import { LiveShell } from "@/components/shell/LiveShell";
import { LOOK_PREPAINT_SCRIPT } from "@/lib/looks/prepaint";

export const metadata: Metadata = {
  title: "Automatos Play",
  description: "Your Automatos, the fun way.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The pre-paint script sets the Look's variables on <html> before React hydrates it.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* A constant built from lib/looks/catalogue.ts: the one inline script in Play. It reads only
            the stored Look, checked against the catalogue's keys. Never put user text into it. */}
        <script dangerouslySetInnerHTML={{ __html: LOOK_PREPAINT_SCRIPT }} />
      </head>
      <body>
        <LookProvider>
          <LiveShell>{children}</LiveShell>
        </LookProvider>
      </body>
    </html>
  );
}
