import Image from "next/image";

// AI : nominal aliases so paths/copy aren't interchangeable plain strings
type ImagePath = string;
type SectionId = string;
type AppLoginUrl = string;
type AppUrl = string;

const APP_URL: AppUrl = "https://auto-pipeline-app.dev/";
const APP_LOGIN_URL: AppLoginUrl = "https://auto-pipeline-app.dev/login?next=%2F";

type Feature = {
  id: SectionId;
  num: string;
  name: string;
  headline: string;
  body: string;
  bullets: string[];
  image: ImagePath;
};

const FEATURES: Feature[] = [
  {
    id: "structure",
    num: "01",
    name: "Structure",
    headline: "Define the shape of every answer.",
    body: "Build pydantic / zod models in a UI or in code. Every step's input and output is validated against a structure — schema validation is implicit on all I/O, never a separate step you can forget.",
    bullets: [
      "UI builder and code view of the same models",
      "`text` instead of `string` for non-technical reviewers",
      "`tuple[text, quote]` links extractions back to the source",
    ],
    image: "/screens/s-structure.png",
  },
  {
    id: "pipeline",
    num: "02",
    name: "Pipeline",
    headline: "Linear pipelines that flag their own breakages.",
    body: "Each step declares its input and output model. When an output flows into a step expecting something else, the UI marks the pipeline invalid and run buttons go dark — before you spend a cent on inference.",
    bullets: [
      "PDF, Word, Excel, JSON and web inputs",
      "Custom TypeScript function steps and batch LLM steps",
      "Per-step caching: never recompute or re-bill a finished step",
    ],
    image: "/screens/s-pipeline.png",
  },
  {
    id: "abtest",
    num: "03",
    name: "A/B Test",
    headline: "Benchmark strategies, not vibes.",
    body: "Run the same task as a single LLM call, a Recursive Language Model, a frontier coding agent, or an agent loop on a cheap open model. An LLM judge picks the winner on accuracy, schema pass-rate, latency and cost.",
    bullets: [
      "Cheap Chinese models first, frontier only if needed",
      "Syntax-highlighted logs from RLM and agent runs",
      "Accuracy / pass / latency / cost on every strategy card",
    ],
    image: "/screens/s-abtest.png",
  },
  {
    id: "inference",
    num: "04",
    name: "Inference",
    headline: "Drag a document on. No deploy.",
    body: "Run the live pipeline by dropping a file onto an input slot, then share a link to just this page. Cached steps return instantly at $0.00; progress streams in as each step completes.",
    bullets: [
      "Shareable run page — nothing to deploy",
      "Per-step run buttons, dark when the pipeline is invalid",
      "Validated output with click-to-source quotes",
    ],
    image: "/screens/s-infer-done.png",
  },
  {
    id: "logging",
    num: "05",
    name: "Logging",
    headline: "Every run, fully traced.",
    body: "Each inference run is recorded with a per-step trace, token counts and cost. Detailed technical logs with syntax highlighting, plus a high-level HTML view with progress bars for everyone else.",
    bullets: [
      "Filter by model, step or run id",
      "Download any run's logs",
      "`_latest` plus timestamped artifacts for every step",
    ],
    image: "/screens/s-logging.png",
  },
  {
    id: "documents",
    num: "06",
    name: "Documents",
    headline: "Content-addressed. Never pay twice.",
    body: "Every uploaded document hashes to one id, so identical files dedupe automatically and cached work is reused. PDFs get both a PDF view and a text view; runs save their inputs and outputs alongside.",
    bullets: [
      "Hash-based dedupe across inference and training uploads",
      "Previous runs stored as typed JSON with their structure attached",
      "Inference / training labels on every file",
    ],
    image: "/screens/s-documents.png",
  },
  {
    id: "billing",
    num: "07",
    name: "Billing",
    headline: "See exactly where spend goes.",
    body: "Cost is attributed per model and per processing service. Watch the cheap/open vs frontier split, daily spend by model, and how much caching saved you versus recomputing everything.",
    bullets: [
      "Daily spend stacked by model",
      "Open / cheap vs frontier model split",
      "Cache savings computed against a no-cache baseline",
    ],
    image: "/screens/s-billing4.png",
  },
];

type Stat = { value: string; label: string };

const STATS: Stat[] = [
  { value: "3×", label: "typical overspend from using frontier models to patch one-time engineering problems" },
  { value: "$0.00", label: "cost of a cached step — finished work is never recomputed or re-billed" },
  { value: "100%", label: "of step I/O schema-validated, implicitly, on every run" },
];

// AI : framed screenshot with fake window chrome so raw pngs read as product UI
function Shot({ src, alt, priority = false }: { src: ImagePath; alt: string; priority?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden shadow-[0_0_60px_-20px_rgba(52,211,153,0.25)]">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="ml-2 font-mono text-[10px] text-muted truncate">{alt}</span>
      </div>
      <Image src={src} alt={alt} width={1024} height={461} priority={priority} className="w-full h-auto" />
    </div>
  );
}

function FeatureRow({ feature, flip }: { feature: Feature; flip: boolean }) {
  return (
    <div id={feature.id} className="grid items-center gap-10 lg:grid-cols-2 scroll-mt-24">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="font-mono text-sm text-accent">
          {feature.num} / {feature.name}
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{feature.headline}</h3>
        <p className="mt-4 text-muted leading-relaxed">{feature.body}</p>
        <ul className="mt-6 space-y-2.5">
          {feature.bullets.map((b: string) => (
            <li key={b} className="flex gap-3 text-sm text-foreground/85">
              <span className="mt-0.5 text-accent">▸</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>
        <Shot src={feature.image} alt={`forge — ${feature.name.toLowerCase()}`} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex-1">
      {/* nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <a href="#" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded bg-accent font-mono text-sm font-bold text-background">
              F
            </span>
            <span className="font-semibold tracking-tight">Forge</span>
            <span className="hidden font-mono text-xs text-muted sm:inline">ai engineering pipeline builder</span>
          </a>
          <div className="hidden items-center gap-6 font-mono text-xs text-muted md:flex">
            {FEATURES.slice(0, 4).map((f: Feature) => (
              <a key={f.id} href={`#${f.id}`} className="hover:text-foreground transition-colors">
                {f.name}
              </a>
            ))}
            <a
              href={APP_LOGIN_URL}
              className="rounded bg-accent px-3 py-1.5 font-semibold text-background hover:bg-accent/85 transition-colors"
            >
              Get a demo
            </a>
          </div>
        </nav>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 text-center sm:pt-28">
          <p className="mx-auto inline-block rounded-full border border-line bg-panel px-4 py-1.5 font-mono text-xs text-accent">
            ● validated AI, from input to output
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            AI engineering is hard.
            <br />
            <span className="text-accent">Your pipeline shouldn&apos;t be.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Forge turns LLM work into typed, cached, validated pipeline steps. Define structures, wire steps together,
            A/B test strategies on cheap open models, and ship a drag-and-drop inference page — no deploy required.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <a
              id="cta-top"
              href={APP_URL}
              className="rounded bg-accent px-6 py-3 font-mono text-sm font-semibold text-background hover:bg-accent/85 transition-colors"
            >
              Try now
            </a>
          </div>
          {/* AI : hackathon credit only — deliberately worded to avoid implying funding/affiliation */}
          <a
            href="https://www.antler.co/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-2.5 font-mono text-xs text-muted hover:text-foreground transition-colors"
          >
            <span>built at the</span>
            <Image
              src="/antler-logo.svg"
              alt="Antler"
              width={67}
              height={16}
              className="brightness-0 invert opacity-80"
            />
            <span>hackathon · independent, not funded</span>
          </a>
          <div className="mt-14 text-left">
            <Shot src="/screens/s-pipeline.png" alt="forge — pipeline builder" priority />
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="border-y border-line bg-panel/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3">
          {STATS.map((s: Stat) => (
            <div key={s.value}>
              <p className="font-mono text-4xl font-semibold text-accent">{s.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl space-y-28 px-6 py-24">
        <div className="text-center">
          <p className="font-mono text-sm text-accent">the whole loop, one tool</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Structure → Pipeline → Test → Ship
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            Seven windows per project. Each one removes a piece of AI engineering you&apos;d otherwise hand-roll.
          </p>
        </div>
        {FEATURES.map((f: Feature, i: number) => (
          <FeatureRow key={f.id} feature={f} flip={i % 2 === 1} />
        ))}
      </section>

      {/* validated text spotlight */}
      <section className="border-y border-line bg-panel/50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-24 lg:grid-cols-2">
          <div>
            <p className="font-mono text-sm text-accent">✓ validated text</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Click any extracted quote.
              <br />
              Jump to its source.
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              Every span an LLM extracts is validated against the original document and stored with langextract-style
              character offsets. One click takes a reviewer from the model&apos;s claim to the exact highlighted passage —
              that&apos;s what makes the output trustworthy enough to act on.
            </p>
            <p className="mt-4 font-mono text-xs text-muted">
              text → list[tuple[text, quote]] · closest-match fallback · offsets stored with the run
            </p>
          </div>
          <Shot src="/screens/s-docviewer.png" alt="forge — source document viewer" />
        </div>
      </section>

      {/* default example pipeline */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="font-mono text-sm text-accent">default project</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Company Legal Evaluation</h2>
            <p className="mt-4 leading-relaxed text-muted">
              Forge ships with a working example: ingest a legal PDF, extract atomic rules with source quotes, combine
              with company data, and output a legal considerations report — every step typed and cached.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-panel p-6 font-mono text-sm leading-7">
            {[
              ["01", "Legal Document", "pdf → SourceDocument"],
              ["02", "Doc → Text", "SourceDocument → SourceDocument"],
              ["03", "Extract Atomic Rules", "SourceDocument → list[AtomicRule]"],
              ["04", "Sort Rules by Severity", "custom ts fn · $0 LLM cost"],
              ["05", "Company Data + Combine", "word → EvaluationInput"],
              ["06", "Legal Considerations", "EvaluationInput → LegalConsiderations"],
            ].map(([num, name, io]: string[]) => (
              <div key={num} className="flex items-baseline gap-3 border-b border-line/60 py-2 last:border-0">
                <span className="text-muted">{num}</span>
                <span className="text-foreground">{name}</span>
                <span className="ml-auto text-right text-xs text-accent/80">{io}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section id="cta" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Stop paying frontier prices
            <br />
            for <span className="text-accent">pipeline problems.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted">
            Cheap open models, properly structured and validated, beat an expensive model on a messy prompt. Forge is
            how you get there.
          </p>
          <a
            href={APP_LOGIN_URL}
            className="mt-8 inline-block rounded bg-accent px-8 py-3.5 font-mono text-sm font-semibold text-background hover:bg-accent/85 transition-colors"
          >
            ⚡ Book a demo
          </a>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 font-mono text-xs text-muted sm:flex-row">
          <span>Forge — ai engineering pipeline builder</span>
          <span>pipelines are linear. left to right.</span>
        </div>
      </footer>
    </main>
  );
}
