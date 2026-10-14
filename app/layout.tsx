import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
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
