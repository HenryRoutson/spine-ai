import { HOSTED_SITE_AUTH_SLOT, HOSTED_SITE_RUN_SLOT } from "@/lib/hosted-site-slots"

// AI : default public page — product chrome around {{run}}, good enough to vibe-code Spine-in-Spine from.
export const DEFAULT_HOSTED_SITE_HTML = `<nav class="hs-nav">
  <div class="hs-nav-brand">
    {{logo}}
    <span class="hs-nav-name">{{company}}</span>
  </div>
  <div class="hs-nav-links">
    <a class="hs-nav-link" href="#run">Workspace</a>
    <span class="hs-nav-account">{{email}}</span>
  </div>
</nav>
<header class="hs-hero">
  <p class="hs-kicker">Hosted workspace</p>
  <h1 class="hs-title">{{tagline}}</h1>
  <p class="hs-lede">Upload work, run a typed pipeline, and get a structured result — no website of your own to host.</p>
  <a class="hs-hero-cta" href="#run">Open workspace</a>
</header>
<section class="hs-features" aria-label="Product">
  <article class="hs-feature">
    <p class="hs-feature-kicker">01</p>
    <h2>Typed in, typed out</h2>
    <p>Every run is a structured pipeline. Inputs, steps, and outputs stay aligned so the page can grow into a real product.</p>
  </article>
  <article class="hs-feature">
    <p class="hs-feature-kicker">02</p>
    <h2>Your brand, our host</h2>
    <p>Colors, copy, and layout are yours. Spine hosts the page and the run — sign-in stays available later if you need it.</p>
  </article>
  <article class="hs-feature">
    <p class="hs-feature-kicker">03</p>
    <h2>Ready to vibe</h2>
    <p>Describe the product in the studio. Keep the run slot where the workspace belongs. The rest is HTML you can ship.</p>
  </article>
</section>
<section class="hs-run" id="run">
  <div class="hs-workspace-head">
    <p class="hs-kicker">Live workspace</p>
    <h2 class="hs-workspace-title">Run {{company}}</h2>
    <p class="hs-lede hs-lede-tight">Drop files in, run, and read the result in place.</p>
  </div>
${HOSTED_SITE_RUN_SLOT}
</section>
<footer class="hs-footer">
  <span>{{company}}</span>
  <span class="hs-footer-meta">Hosted pipeline</span>
</footer>
`

// AI : default sign-in page — {{auth}} is the real form; HTML around it is vibe-coded chrome.
export const DEFAULT_HOSTED_SITE_AUTH_HTML = `<section class="hs-auth" id="signin">
  <div class="hs-auth-copy">
    {{logo}}
    <p class="hs-kicker">{{company}}</p>
    <h1 class="hs-title">Sign in</h1>
    <p class="hs-lede">Continue to your workspace. Accounts are handled for you.</p>
  </div>
${HOSTED_SITE_AUTH_SLOT}
</section>
`

// AI : extra page default — workspace around {{run}}; landing stays customHtml / hosted/index.html.
export const DEFAULT_HOSTED_SITE_WORKSPACE_HTML = `<section class="hs-run" id="run">
  <div class="hs-workspace-head">
    <p class="hs-kicker">Live workspace</p>
    <h2 class="hs-workspace-title">Run {{company}}</h2>
    <p class="hs-lede hs-lede-tight">Drop files in, run, and read the result in place.</p>
  </div>
${HOSTED_SITE_RUN_SLOT}
</section>
`

export function defaultHostedSiteCss(): string {
  return `
.hs-root { min-height: 100dvh; background: var(--hs-bg); color: var(--hs-fg); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: -0.014em; }
.hs-nav { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.9rem 1.5rem; border-bottom: 1px solid color-mix(in srgb, var(--hs-fg) 8%, transparent); background: color-mix(in srgb, var(--hs-bg) 88%, transparent); backdrop-filter: blur(12px); }
.hs-nav-brand { display: flex; align-items: center; gap: 0.65rem; min-width: 0; }
.hs-nav-name { font-size: 0.92rem; font-weight: 650; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hs-nav-links { display: flex; align-items: center; gap: 0.55rem; flex-shrink: 0; }
.hs-nav-link, .hs-nav-cta, .hs-hero-cta { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-size: 0.8rem; font-weight: 550; }
.hs-nav-link { color: color-mix(in srgb, var(--hs-fg) 72%, transparent); padding: 0.35rem 0.55rem; }
.hs-nav-account { font-size: 0.72rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: color-mix(in srgb, var(--hs-fg) 58%, transparent); padding: 0.35rem 0.55rem; }
.hs-nav-cta, .hs-hero-cta { color: #fff; background: var(--hs-primary); padding: 0.42rem 0.85rem; border-radius: 999px; }
.hs-hero { padding: 4.25rem 1.5rem 2.25rem; text-align: center; }
.hs-logo { display: block; height: 2.5rem; margin: 0 auto 1rem; object-fit: contain; }
.hs-nav .hs-logo { height: 1.45rem; margin: 0; }
.hs-auth-copy .hs-logo { height: 2.15rem; margin: 0 auto 0.85rem; }
.hs-kicker { margin: 0; font-size: 0.7rem; font-weight: 650; letter-spacing: 0.16em; text-transform: uppercase; color: var(--hs-accent); }
.hs-title { margin: 0.65rem auto 0; max-width: 40rem; font-size: clamp(1.85rem, 4.4vw, 3.1rem); line-height: 1.12; font-weight: 680; letter-spacing: -0.038em; }
.hs-lede { margin: 0.9rem auto 0; max-width: 34rem; font-size: 1.02rem; line-height: 1.55; color: color-mix(in srgb, var(--hs-fg) 68%, transparent); }
.hs-lede-tight { margin-top: 0.45rem; font-size: 0.92rem; }
.hs-hero-cta { margin-top: 1.4rem; padding: 0.7rem 1.15rem; font-size: 0.88rem; }
.hs-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.85rem; padding: 0 1.5rem 2.5rem; max-width: 68rem; margin: 0 auto; }
.hs-feature { padding: 1.15rem 1.1rem 1.2rem; border-radius: 1rem; border: 1px solid color-mix(in srgb, var(--hs-fg) 9%, transparent); background: color-mix(in srgb, #fff 72%, var(--hs-bg)); }
.hs-feature-kicker { margin: 0 0 0.55rem; font-size: 0.68rem; font-weight: 650; letter-spacing: 0.14em; color: var(--hs-accent); }
.hs-feature h2 { margin: 0; font-size: 1.02rem; font-weight: 650; letter-spacing: -0.02em; }
.hs-feature p { margin: 0.45rem 0 0; font-size: 0.88rem; line-height: 1.5; color: color-mix(in srgb, var(--hs-fg) 64%, transparent); }
.hs-run { padding: 0 1rem 2.75rem; }
.hs-workspace-head { max-width: 56rem; margin: 0 auto 1rem; text-align: center; }
.hs-workspace-title { margin: 0.4rem 0 0; font-size: 1.25rem; font-weight: 650; letter-spacing: -0.025em; text-align: center; }
.hs-run-slot, .hs-output-slot, .hs-chatbot-slot, .hs-docs-slot { margin: 0 auto; max-width: 56rem; border-radius: 1.1rem; overflow: hidden; border: 1px solid color-mix(in srgb, var(--hs-fg) 10%, transparent); box-shadow: 0 22px 60px color-mix(in srgb, var(--hs-fg) 12%, transparent); background: var(--hs-fn-bg, #fff); color: var(--hs-fn-fg, inherit); }
.hs-fn { color: var(--hs-fn-fg, inherit); background: var(--hs-fn-bg, transparent); }
.hs-fn .bg-background { background: var(--hs-fn-bg); }
.hs-run-slot .hs-fn { min-height: 0; }
.hs-sql-slot, .hs-action-slot { margin: 0 auto; max-width: 28rem; text-align: center; }
.hs-sql-slot { margin-top: 2.25rem; }
.hs-action-row { display: flex; flex-wrap: wrap; justify-content: center; align-items: stretch; gap: 1rem; width: 100%; margin: 0 auto 4rem; padding: 0 1.25rem; }
.hs-action-row .hs-action-slot { margin: 0; max-width: 17.5rem; width: 17.5rem; flex: 0 0 17.5rem; text-align: center; }
.hs-action-widget { width: 100%; }
.hs-action-card { display: flex; flex-direction: column; height: 100%; padding: 1.15rem 1.15rem 1.2rem; border-radius: 1.05rem; border: 1px solid color-mix(in srgb, var(--hs-fg) 10%, transparent); background: color-mix(in srgb, #fff 82%, var(--hs-bg)); box-shadow: 0 10px 28px color-mix(in srgb, var(--hs-fg) 7%, transparent); text-align: center; }
.hs-action-card-title { margin: 0 0 0.85rem; font-size: 0.68rem; font-weight: 650; letter-spacing: 0.16em; text-transform: uppercase; color: var(--hs-accent); }
.hs-action-preview { display: grid; gap: 0.4rem; margin: 0 0 1.05rem; min-height: 3.5rem; }
.hs-action-eq { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; font-variant-numeric: tabular-nums; }
.hs-action-eq-expr { font-size: 0.95rem; color: color-mix(in srgb, var(--hs-fg) 62%, transparent); }
.hs-action-eq-to { font-size: 1.2rem; font-weight: 650; letter-spacing: -0.03em; }
.hs-action-btn { width: 100%; min-width: 0; height: 2.55rem; border: 0; border-radius: 999px; background: var(--hs-accent); color: #fff; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
.hs-action-btn:disabled { opacity: 0.6; cursor: wait; }
.hs-step-trace { margin-top: 0.95rem; padding: 0.75rem 0.8rem; border-radius: 0.8rem; border: 1px solid color-mix(in srgb, var(--hs-fg) 10%, transparent); background: color-mix(in srgb, var(--hs-bg) 92%, #fff); text-align: left; }
.hs-arith-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.15rem 0.5rem; align-items: center; font-size: 0.82rem; color: var(--hs-fg); }
.hs-arith-copy { display: flex; flex-direction: column; min-width: 0; }
.hs-arith-sql { font-size: 0.68rem; opacity: 0.55; font-variant-numeric: tabular-nums; }
.hs-arith-eq { font-variant-numeric: tabular-nums; font-weight: 650; letter-spacing: -0.02em; }
.hs-output-slot, .hs-chatbot-slot, .hs-docs-slot { margin-top: 1rem; margin-bottom: 1rem; }
.hs-foot, .hs-footer { padding: 0 1.5rem 2rem; text-align: center; font-size: 0.72rem; opacity: 0.55; }
.hs-footer { display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; }
.hs-footer a, .hs-foot a { color: inherit; }
.hs-auth { min-height: 72dvh; display: grid; place-items: center; padding: 3rem 1.25rem 2.5rem; }
.hs-auth-copy { text-align: center; margin-bottom: 1.35rem; }
.hs-auth-slot { width: 100%; max-width: 24rem; margin: 0 auto; }
.hs-auth-card { padding: 1.25rem; border-radius: 1.1rem; border: 1px solid color-mix(in srgb, var(--hs-fg) 10%, transparent); background: #fff; box-shadow: 0 18px 50px color-mix(in srgb, var(--hs-fg) 10%, transparent); }
.hs-auth-note { margin: 0 0 0.9rem; padding: 0.7rem 0.8rem; border-radius: 0.7rem; font-size: 0.75rem; line-height: 1.45; background: color-mix(in srgb, var(--hs-accent) 10%, #fff); color: var(--hs-fg); }
.hs-account { display: flex; justify-content: flex-end; align-items: center; gap: 0.6rem; padding: 0.65rem 0.85rem; font-size: 0.72rem; border-bottom: 1px solid color-mix(in srgb, var(--hs-fg) 8%, transparent); color: color-mix(in srgb, var(--hs-fg) 62%, transparent); }
.hs-split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; max-width: 72rem; margin: 0 auto; padding: 0 1.25rem 3rem; }
.hs-split .hs-run-slot { max-width: none; margin: 0; }
.hs-split-heads { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; max-width: 72rem; margin: 0 auto; padding: 1.5rem 1.25rem 0.35rem; text-align: center; }
.hs-split-head { text-align: center; min-width: 0; }
.hs-split-heads .hs-kicker, .hs-split-heads .hs-workspace-title { text-align: center; }
.hs-sql-table-wrap { overflow-x: auto; text-align: left; }
.hs-sql-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.hs-sql-table th, .hs-sql-table td { padding: 0.55rem 0.7rem; border-bottom: 1px solid color-mix(in srgb, var(--hs-fg) 10%, transparent); }
.hs-sql-table th { font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: color-mix(in srgb, var(--hs-fg) 55%, transparent); font-weight: 650; }
.hs-sql-caption { margin-top: 0.65rem; font-size: 0.85rem; color: color-mix(in srgb, var(--hs-fg) 58%, transparent); }
@media (max-width: 860px) {
  .hs-split { grid-template-columns: 1fr; }
  .hs-split-heads { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .hs-features { grid-template-columns: 1fr; }
  .hs-hero { padding: 2.6rem 1.15rem 1.6rem; }
  .hs-nav { padding: 0.75rem 1rem; }
  .hs-nav-link { display: none; }
}
`
}
