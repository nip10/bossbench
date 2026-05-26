import { GeistMono } from "geist/font/mono";
import { GeistPixelLine } from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bossbench.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Bossbench — Open-source pg-boss dashboard",
  description:
    "A Postgres-native, open-source pg-boss dashboard for modern Node apps. Inspect jobs, queues, schedules, warnings, dead-letter data, metrics, and guarded pg-boss actions from one embedded UI.",
  applicationName: "Bossbench",
  keywords: [
    "pg-boss dashboard",
    "pg-boss UI",
    "Postgres queue dashboard",
    "PostgreSQL job queue dashboard",
    "Node.js queue dashboard",
    "open-source pg-boss dashboard",
    "pg-boss monitoring",
    "pg-boss schedules",
  ],
  authors: [
    {
      name: "Bossbench contributors",
      url: "https://github.com/nip10/bossbench",
    },
  ],
  creator: "Bossbench contributors",
  publisher: "Bossbench",
  category: "Developer Tools",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Bossbench — Open-source pg-boss dashboard",
    description:
      "Postgres-native pg-boss dashboard with read-only browsing and guarded queue mutations through pg-boss APIs.",
    url: SITE_URL,
    siteName: "Bossbench",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/app-icon.svg",
        alt: "Bossbench — open-source pg-boss dashboard",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Bossbench — Open-source pg-boss dashboard",
    description:
      "Inspect pg-boss jobs, queues, schedules, warnings, metrics, and guarded actions from one embedded UI.",
    images: ["/app-icon.svg"],
  },
  icons: {
    icon: "/app-icon.svg",
  },
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Bossbench",
      url: SITE_URL,
      logo: `${SITE_URL}/app-icon.svg`,
      sameAs: [
        "https://github.com/nip10/bossbench",
        "https://www.npmjs.com/search?q=%40bossbench",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Bossbench",
      url: SITE_URL,
      description:
        "Bossbench is an open-source, Postgres-native dashboard for pg-boss queues and jobs.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Bossbench",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Node.js",
      url: SITE_URL,
      codeRepository: "https://github.com/nip10/bossbench",
      license: "https://github.com/nip10/bossbench/blob/main/LICENSE",
      description:
        "Open-source dashboard for pg-boss with Postgres-backed reads, read-only browsing, and guarded mutations through pg-boss public APIs.",
      softwareRequirements: "Node.js, PostgreSQL, pg-boss",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Bossbench?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Bossbench is an open-source dashboard for pg-boss. It lets Node.js developers inspect Postgres-backed jobs, queues, schedules, warnings, dead-letter jobs, metrics, and guarded queue actions from an embedded UI.",
          },
        },
        {
          "@type": "Question",
          name: "Does Bossbench support read-only mode?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Bossbench supports read-only browsing and browse-only operation without a live PgBoss instance. Mutations require readonly mode to be disabled and a live PgBoss instance configured.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelLine.variable}`}
    >
      <body>
        <script type="application/ld+json">{JSON.stringify(siteJsonLd)}</script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
