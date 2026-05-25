import { GeistMono } from "geist/font/mono";
import { GeistPixelLine } from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bossbench — Open-source pg-boss dashboard",
  description:
    "A beautiful, open-source pg-boss dashboard for modern Node apps. Inspect SQL-backed jobs and queues, and drive pg-boss actions from a single embedded UI.",
  icons: {
    icon: "/app-icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelLine.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
