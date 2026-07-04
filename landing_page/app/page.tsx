import Image from "next/image";
import { LandingNav } from "../components/landing-nav";
import { AppLivePreview } from "../components/app-live-preview";
import { LegalFooterLinks } from "@/lib/legal/chrome";

type AppLoginUrl = string;
type AppUrl = string;
type AppPreviewUrl = string;

const APP_URL: AppUrl = "https://www.spine-ai-app.dev/";
const APP_LOGIN_URL: AppLoginUrl = "https://app.usespine.com/login?next=%2F";
const APP_PREVIEW_URL: AppPreviewUrl =
  process.env.NEXT_PUBLIC_APP_PREVIEW_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000/demo?embed=1"
    : `${APP_URL.replace(/\/$/, "")}/demo?embed=1`);

type FaqItem = {
  num: string;
  q: string;
  a: string;
};

const NAV_LINKS = [{ href: "#faq", label: "FAQs" }];

const FAQS: FaqItem[] = [
  {
    num: "01",
    q: "Who is this for?",
    a: "Anyone developing high-throughput projects with strict quality requirements. Do you have 800 pages to sort through?",
  },
  {
    num: "02",
    q: "Can I write code in this?",
    a: "Yes!",
  },
  {
    num: "03",
    q: "Why can't I use Python instead?",
    a: "You can! But why would you write all the boilerplate we've handled?",
  },
  {
    num: "04",
    q: "How do I share what I make?",
    a: "Create a link to inference with a couple clicks, or export the whole project as TypeScript or Python.",
  },
  {
    num: "05",
    q: "Do I need to write prompts?",
    a: "Probably not! We use structures to automatically generate prompts for you.",
  },
  {
    num: "06",
    q: "How long does it take to complete a project?",
    a: "Sometimes as little as 30 seconds for our agent to finish a project.",
  },
];

export default function Home() {
  return (
    <main className="grain-bg flex-1" id="main-content">
      <LandingNav links={NAV_LINKS} loginUrl={APP_LOGIN_URL} />

      {/* hero */}
      <section className="mx-auto max-w-[1200px] border-x border-b border-line">
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <div className="zeero-badge mb-8 w-fit">
            <span className="zeero-badge-new">Validated AI</span>
          </div>
          <h1 className="text-4xl font-normal leading-[1.08] tracking-tight sm:text-[52px]">
            AI engineering is hard.
            <br />
            It shouldn&apos;t be.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Spine turns LLM work into typed, cached, validated pipeline steps. Define structures, wire steps
            together, and ship a drag-and-drop inference page — no deploy required.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={APP_URL} className="zeero-btn !text-lg !px-8 !py-4">
              Try now
            </a>
          </div>
          <div className="mt-10 flex flex-col gap-3">
            <a
              href="https://home.kpmg/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              <span>developed by engineers from</span>
              <Image src="/kpmg-logo.png" alt="KPMG" width={50} height={20} className="grayscale opacity-90" />
            </a>
            <a
              href="https://www.antler.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              <span>built at the</span>
              <Image src="/antler-logo.svg" alt="Antler" width={67} height={16} className="brightness-0 invert opacity-70" />
              <span>hackathon · independent, not funded</span>
            </a>
          </div>
        </div>
      </section>

      {/* live preview */}
      <section className="mx-auto max-w-[1200px] border-x border-b border-line px-8 py-10 sm:px-12 sm:py-12">
        <AppLivePreview src={APP_PREVIEW_URL} />
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-dim">
          click around — no sign-in required
        </p>
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
          </div>
        </div>
        <div className="px-8 py-6 sm:px-12">
          <p className="text-xs text-muted-dim">© 2026 Spine. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
