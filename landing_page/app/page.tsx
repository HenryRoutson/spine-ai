import Image from "next/image";
import { LandingNav } from "../components/landing-nav";
import { LegalFooterLinks } from "@/lib/legal/chrome";

type SectionId = string;
type AppLoginUrl = string;
type AppUrl = string;

const APP_URL: AppUrl = "https://app.usespine.com/";
const APP_LOGIN_URL: AppLoginUrl = "https://app.usespine.com/login?next=%2F";

type Feature = {
  id: SectionId;
  name: string;
  headline: string;
  body: string;
};

type FeatureCard = {
  title: string;
  body: string;
};

type FaqItem = {
  num: string;
  q: string;
  a: string;
};

type LogStep = {
  action: string;
  time: string;
  status: string;
  agent: string;
};

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQs" },
];

const HERO_LOG: LogStep[] = [
  { action: "Opened pipeline builder", time: "12:41:03", status: "step.ok", agent: "pipeline-agent" },
  { action: "Defined LegalConsiderations schema", time: "12:41:07", status: "step.ok", agent: "structure-agent" },
  { action: "Wired PDF → extract → combine", time: "12:41:09", status: "step.ok", agent: "pipeline-agent" },
  { action: "Dropped legal.pdf on input slot", time: "12:41:13", status: "step.ok", agent: "inference-agent" },
  { action: "Cache hit on steps 1–3", time: "12:41:18", status: "$0.00", agent: "cache-agent" },
  { action: "Output validated against schema", time: "12:41:20", status: "pass.confirmed", agent: "schema-agent" },
];

const OVERVIEW: Feature[] = [
  {
    id: "structure",
    name: "Structure",
    headline: "Define the shape of every answer.",
    body: "Build pydantic / zod models in a UI or in code. Every step's input and output is validated against a structure — schema validation is implicit on all I/O.",
  },
  {
    id: "pipeline",
    name: "Pipeline",
    headline: "Linear pipelines that flag their own breakages.",
    body: "Each step declares its input and output model. When types don't match, the UI marks the pipeline invalid and run buttons go dark — before you spend a cent.",
  },
  {
    id: "inference",
    name: "Inference",
    headline: "Drag a document on. No deploy.",
    body: "Run the live pipeline by dropping a file onto an input slot, then share a link. Cached steps return instantly at $0.00; progress streams as each step completes.",
  },
];

const FEATURE_CARDS: FeatureCard[] = [
  {
    title: "Validated Structures",
    body: "UI builder and code view of the same models. text instead of string for reviewers. tuple[text, quote] links extractions back to the source.",
  },
  {
    title: "Smart Pipelines",
    body: "PDF, Word, Excel, JSON and web inputs. Custom TypeScript steps and batch LLM steps. Per-step caching — never recompute or re-bill finished work.",
  },
  {
    title: "A/B Strategy Testing",
    body: "Benchmark single LLM calls, frontier agents, or cheap open models. An LLM judge picks the winner on accuracy, pass-rate, latency and cost.",
  },
  {
    title: "Shareable Inference",
    body: "Drag-and-drop run page with nothing to deploy. Per-step run buttons go dark when invalid. Validated output with click-to-source quotes.",
  },
  {
    title: "Full Run Tracing",
    body: "Every inference recorded with per-step trace, token counts and cost. Syntax-highlighted technical logs plus a high-level HTML view.",
  },
  {
    title: "Cost Attribution",
    body: "Spend per model and service. Open vs frontier split, daily spend by model, and cache savings computed against a no-cache baseline.",
  },
];

const FAQS: FaqItem[] = [
  {
    num: "01",
    q: "Does Spine replace my LLM code?",
    a: "No. It wraps your LLM work in typed, cached pipeline steps with implicit schema validation. You still write prompts and custom functions — Spine handles wiring, validation, caching and cost tracking.",
  },
  {
    num: "02",
    q: "Can I ship inference without deploying?",
    a: "Yes. Drop a document on an input slot and share the run page link. Cached steps return at $0.00 instantly; progress streams as each step completes.",
  },
  {
    num: "03",
    q: "Is this just a prompt playground?",
    a: "No. Spine does not just chat with models. It validates every step's I/O against pydantic/zod structures, flags broken pipelines before run, and attributes cost per model and step.",
  },
  {
    num: "04",
    q: "What does A/B testing actually compare?",
    a: "The same task as a single LLM call, frontier coding agent, or agent loop on a cheap open model. A judge scores accuracy, schema pass-rate, latency and cost.",
  },
  {
    num: "05",
    q: "What do I get after a pipeline run?",
    a: "Validated JSON output, per-step traces with token counts and cost, syntax-highlighted logs, and click-to-source quotes linking extractions back to the original document.",
  },
  {
    num: "06",
    q: "How does caching work?",
    a: "Every uploaded document hashes to one id, so identical files dedupe automatically. Finished steps are never recomputed or re-billed — cached work returns at $0.00.",
  },
];

function TerminalPreview({ title, steps }: { title: string; steps: LogStep[] }) {
  return (
    <div className="terminal-window h-full">
      <div className="terminal-titlebar">
        <span className="terminal-dot bg-[#ff5f57]" />
        <span className="terminal-dot bg-[#febc2e]" />
        <span className="terminal-dot bg-[#28c840]" />
        <span className="ml-2 flex items-center gap-2 font-mono text-xs text-muted">
          {title}
          <span className="live-dot" />
          <span className="text-accent">live</span>
        </span>
      </div>
      <div className="px-4 py-2">
        {steps.map((step: LogStep) => (
          <div key={step.time + step.action} className="log-line">
            <div>
              <p className="text-foreground/90">
                <span className="text-muted">&gt;-</span> {step.action}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-dim">
                {step.time} / {step.status}
              </p>
            </div>
            <span className="log-tag">{step.agent}</span>
          </div>
        ))}
        <p className="py-3 font-mono text-[10px] text-muted-dim">watching pipeline</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="grain-bg flex-1" id="main-content">
      <LandingNav links={NAV_LINKS} loginUrl={APP_LOGIN_URL} />

      {/* hero — zeeroday split grid */}
      <section className="mx-auto max-w-[1200px] border-x border-line">
        <div className="grid md:grid-cols-2">
          <div className="flex flex-col justify-center border-b border-line p-8 sm:p-12 md:border-b-0 md:border-r">
            <div className="zeero-badge mb-8 w-fit">
              <span className="zeero-badge-new">New</span>
              <span className="zeero-badge-label">Validated AI</span>
            </div>
            <h1 className="text-4xl font-normal leading-[1.08] tracking-tight sm:text-[52px]">
              AI engineering is hard.
              <br />
              Your pipeline shouldn&apos;t be.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              Spine turns LLM work into typed, cached, validated pipeline steps. Define structures, wire steps
              together, A/B test strategies, and ship a drag-and-drop inference page — no deploy required.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={APP_URL} className="zeero-btn !text-lg !px-8 !py-4">
                Try now
              </a>
            </div>
            <a
              href="https://www.antler.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-flex items-center gap-2.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              <span>built at the</span>
              <Image src="/antler-logo.svg" alt="Antler" width={67} height={16} className="brightness-0 invert opacity-70" />
              <span>hackathon · independent, not funded</span>
            </a>
          </div>
          <div className="border-b border-line p-6 sm:p-8">
            <TerminalPreview title="Spine · Pipeline Run" steps={HERO_LOG} />
          </div>
        </div>

      </section>

      {/* 3-step overview — zeeroday feature rows */}
      <section className="mx-auto max-w-[1200px] border-x border-line">
        {OVERVIEW.map((feature: Feature, i: number) => (
          <div
            key={feature.id}
            id={feature.id}
            className={`grid scroll-mt-24 md:grid-cols-2 ${i < OVERVIEW.length - 1 ? "border-b border-line" : ""}`}
          >
            <div
              className={`flex min-h-[280px] items-center justify-center border-b border-line p-10 md:min-h-[360px] md:border-b-0 ${
                i % 2 === 1 ? "md:order-2 md:border-l" : "md:border-r"
              }`}
            >
              <div className="relative w-full max-w-sm">
                <div className="absolute inset-0 rounded-xl border border-accent/20 bg-accent/5" />
                <div className="relative p-6">
                  <div className="mx-auto h-32 w-32 rounded-lg border border-accent/40 bg-accent/10 shadow-[0_0_40px_-10px_var(--accent-dim)]" />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((n: number) => (
                      <div key={n} className="h-2 rounded-full bg-accent/30" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className={`flex flex-col justify-center p-8 sm:p-12 ${i % 2 === 1 ? "md:order-1" : ""}`}>
              <h3 className="text-2xl font-normal tracking-tight sm:text-3xl">{feature.headline}</h3>
              <p className="mt-4 max-w-md leading-relaxed text-muted">{feature.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* feature grid */}
      <section id="features" className="mx-auto max-w-[1200px] scroll-mt-24 border-x border-line">
        <div className="border-b border-line px-8 py-10 sm:px-12">
          <h2 className="text-3xl font-normal tracking-tight sm:text-4xl">
            AI engineering built for production pipelines
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((card: FeatureCard, i: number) => (
            <div
              key={card.title}
              className={`p-8 sm:p-10 ${
                i % 3 !== 2 ? "lg:border-r lg:border-line" : ""
              } ${i % 2 === 0 ? "sm:border-r sm:border-line" : ""} ${
                i < FEATURE_CARDS.length - (FEATURE_CARDS.length % 3 || 3) ? "border-b border-line" : ""
              } ${i < FEATURE_CARDS.length - 2 ? "sm:border-b sm:border-line lg:border-b" : ""}`}
            >
              <h4 className="text-lg font-medium">{card.title}</h4>
              <p className="mt-3 text-sm leading-relaxed text-muted">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* validated text spotlight */}
      <section className="mx-auto max-w-[1200px] border-x border-b border-line px-8 py-12 sm:px-12 sm:py-16">
        <h2 className="text-3xl font-normal tracking-tight sm:text-4xl">
          Click any extracted quote.
          <br />
          Jump to its source.
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted">
          Every span an LLM extracts is validated against the original document and stored with character offsets. One
          click takes a reviewer from the model&apos;s claim to the exact highlighted passage.
        </p>
        <p className="mt-4 font-mono text-xs text-muted-dim">
          text → list[tuple[text, quote]] · offsets stored with the run
        </p>
      </section>

      {/* stats row */}
      <section className="mx-auto max-w-[1200px] border-x border-b border-line">
        <div className="grid sm:grid-cols-3">
          {[
            { value: "3×", label: "typical overspend from using frontier models to patch one-time engineering problems" },
            { value: "$0.00", label: "cost of a cached step — finished work is never recomputed or re-billed" },
            { value: "100%", label: "of step I/O schema-validated, implicitly, on every run" },
          ].map((stat: { value: string; label: string }, i: number) => (
            <div
              key={stat.value}
              className={`p-8 sm:p-10 ${i < 2 ? "border-b border-line sm:border-b-0 sm:border-r" : ""}`}
            >
              <p className="font-mono text-4xl font-normal text-foreground">{stat.value}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="mx-auto max-w-[1200px] scroll-mt-24 border-x border-line">
        <div className="border-b border-line px-8 py-10 sm:px-12">
          <h2 className="text-3xl font-normal tracking-tight sm:text-4xl">
            Got questions?
            <br />
            We&apos;ve got answers.
          </h2>
        </div>
        <div>
          {FAQS.map((faq: FaqItem) => (
            <details key={faq.num} className="faq-item group border-b border-line">
              <summary className="flex cursor-pointer items-start gap-6 px-8 py-6 sm:px-12 sm:py-7">
                <span className="font-mono text-sm text-muted-dim">{faq.num}</span>
                <span className="flex-1 text-base font-medium">{faq.q}</span>
                <span className="faq-chevron text-muted transition-transform group-open:rotate-180">▾</span>
              </summary>
              <p className="px-8 pb-7 pl-[4.5rem] text-sm leading-relaxed text-muted sm:px-12 sm:pb-8">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final cta */}
      <section className="mx-auto max-w-[1200px] border-x border-b border-line">
        <div className="px-8 py-20 text-center sm:px-12 sm:py-28">
          <h2 className="text-3xl font-normal tracking-tight sm:text-5xl">
            Stop paying frontier prices
            <br />
            for pipeline problems.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-muted">
            Cheap open models, properly structured and validated, beat an expensive model on a messy prompt.
          </p>
        </div>
      </section>

      {/* footer */}
      <footer className="mx-auto max-w-[1200px] border-x border-line">
        <div className="grid gap-8 border-b border-line px-8 py-12 sm:grid-cols-2 lg:grid-cols-4 sm:px-12">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-dim">Quick Menu</p>
            <div className="mt-4 flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="text-sm text-muted hover:text-foreground">
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-dim">Product</p>
            <div className="mt-4 flex flex-col gap-2">
              <a href={APP_URL} className="text-sm text-muted hover:text-foreground">
                Try now
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-dim">Legal</p>
            <div className="mt-4">
              <LegalFooterLinks linkClassName="text-sm text-muted hover:text-foreground" />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-dim">Information</p>
            <p className="mt-4 text-sm text-muted">Spine — validated AI</p>
            <p className="mt-2 text-sm text-muted-dim">pipelines are linear. left to right.</p>
          </div>
        </div>
        <div className="px-8 py-6 sm:px-12">
          <p className="text-xs text-muted-dim">© 2026 Spine. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
