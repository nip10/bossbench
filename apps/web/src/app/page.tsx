import { ArrowRight, Code, Github, Heart, TerminalSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ActionButton } from "../components/action-button";
import { CopyCommand } from "../components/copy-command";
import { ElysiaLogo } from "../components/logos/elysia";
import { ExpressLogo } from "../components/logos/express";
import { FastifyLogo } from "../components/logos/fastify";
import { HonoLogo } from "../components/logos/hono";
import { NestjsLogo } from "../components/logos/nestjs";
import { NextLogo } from "../components/logos/next";
import {
  JobsMockup,
  MetricsMockup,
  OverviewMockup,
  SchedulersMockup,
} from "../components/mockups";
import { ThemeToggle } from "../components/theme-toggle";

const GITHUB_URL = "https://github.com/nip10/bossbench";
const INSTALL_COMMAND = "npx @bossbench/cli init";
const frameworks = [
  { name: "Hono", Logo: HonoLogo },
  { name: "Express", Logo: ExpressLogo },
  { name: "Fastify", Logo: FastifyLogo },
  { name: "Elysia", Logo: ElysiaLogo },
  { name: "NestJS", Logo: NestjsLogo },
  { name: "Next.js", Logo: NextLogo },
];

export default function Page() {
  return (
    <main className="page-shell">
      <Nav />
      <Hero />

      <Section
        eyebrow="Overview"
        title="Every queue, every job — at a glance."
        body="SQL-backed reads, sharp counts, and health signals without leaving your app. Bossbench keeps the data side in Postgres and the action side in pg-boss."
        align="left"
        mockup={<OverviewMockup />}
      />

      <Section
        eyebrow="Jobs"
        title="Inspect jobs. Replay failures."
        body="A dense table for created, retry, active, completed, cancelled, and failed states — with payloads and timestamps one click away."
        align="right"
        mockup={<JobsMockup />}
      />

      <Section
        eyebrow="Schedulers"
        title="Cron and delayed jobs you can trust."
        body="See repeatable jobs, delayed work, and schedule health in the same shell, adapted to pg-boss terminology."
        align="left"
        mockup={<SchedulersMockup />}
      />

      <Section
        eyebrow="Metrics & alerts"
        title="Throughput, activity, and alert signals without the noise."
        body="Watch completed, failed, and retry buckets over time, then turn pg-boss conditions into config-driven webhook, Slack, or Discord alerts."
        align="right"
        mockup={<MetricsMockup />}
      />

      <DualFeature />
      <BuiltForDevs />
      <InstallSection />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <nav className="top-nav">
      <Link href="/" className="brand-link">
        <Image src="/app-icon.svg" alt="Bossbench" width={28} height={28} />
        <span>bossbench</span>
      </Link>
      <div className="nav-links">
        <a href="#install">Install</a>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">pg-boss dashboard</p>
        <h1 className="hero-headline">
          a beautiful, open-source pg-boss dashboard for modern Node apps.
        </h1>
        <p className="hero-body">
          Inspect SQL-backed reads, explore queue health, and trigger pg-boss
          actions from a single embedded view. Built for Hono, h3/Nitro, Nuxt,
          AdonisJS, TanStack Start, Express, Fastify, Elysia, NestJS, and
          Next.js.
        </p>

        <div className="hero-actions">
          <ActionButton
            href="#install"
            label="Install in your app"
            icon={<TerminalSquare className="icon" />}
            shortcut="I"
            variant="primary"
          />
          <ActionButton
            href={GITHUB_URL}
            label="View on GitHub"
            icon={<Github className="icon" />}
            shortcut="G"
            variant="secondary"
            external
          />
        </div>

        <p className="hero-meta">Postgres reads · pg-boss actions · MIT</p>
      </div>

      <div className="hero-stack">
        <div className="framework-strip">
          {frameworks.map(({ name, Logo }) => (
            <a key={name} href="#install" title={name}>
              <Logo className="logo" />
              <span>{name}</span>
            </a>
          ))}
        </div>
        <div className="hero-command">
          <CopyCommand command={INSTALL_COMMAND} />
        </div>
      </div>
    </section>
  );
}

function Section({
  eyebrow,
  title,
  body,
  align,
  mockup,
}: {
  eyebrow: string;
  title: string;
  body: string;
  align: "left" | "right";
  mockup: ReactNode;
}) {
  return (
    <section className={`feature ${align === "right" ? "feature-right" : ""}`}>
      <div className="feature-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="feature-mockup">{mockup}</div>
    </section>
  );
}

function DualFeature() {
  return (
    <section className="dual-feature">
      <div className="feature-card">
        <Code className="feature-icon" />
        <h3>Reads stay in Postgres.</h3>
        <p>
          Bossbench queries your pg-boss schema for queues, jobs, schedules,
          warnings, metrics, activity, and alerts without changing the API
          shape.
        </p>
      </div>
      <div className="feature-card">
        <Heart className="feature-icon" />
        <h3>Actions stay with pg-boss.</h3>
        <p>
          Keep retries, cancellations, and scheduler actions in the same host
          process that already runs your queue engine, with alert delivery kept
          server-side and opt-in.
        </p>
      </div>
    </section>
  );
}

function BuiltForDevs() {
  return (
    <section className="built-for-devs">
      <div>
        <p className="eyebrow">Supported frameworks</p>
        <h2>Drop into the stack you already ship.</h2>
      </div>
      <div className="framework-grid">
        {frameworks.map(({ name, Logo }) => (
          <div key={name} className="framework-card">
            <Logo className="logo large" />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function InstallSection() {
  return (
    <section className="install" id="install">
      <p className="eyebrow">Install</p>
      <h2>Drop Bossbench into your Node app.</h2>
      <CopyCommand command={INSTALL_COMMAND} variant="inline" />
      <p>
        Add the dashboard beside your pg-boss instance, point it at Postgres,
        and keep the same product feel across Hono, Express, Fastify, Elysia,
        NestJS, and Next.js.
      </p>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="install-link"
      >
        Open the repo <ArrowRight className="icon small" />
      </a>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span>Bossbench</span>
      <span>Open-source pg-boss dashboard</span>
    </footer>
  );
}
