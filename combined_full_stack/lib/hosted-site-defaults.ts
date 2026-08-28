import { HOSTED_SITE_AUTH_SLOT, HOSTED_SITE_RUN_SLOT } from "@/lib/hosted-site-slots"

// AI : default public page — product chrome around {{run}}, good enough to vibe-code Spine-in-Spine from.
// AI : TODO (spine-in-spine-full-F2-css) — add a "spine-full" token theme that matches AppShell
// AI :   (globals.css + app-chrome-header). Simple track keeps these marketing hs-* styles.
// AI :   Pixel chrome-only screenshots first (nav + window header) before full-page diffs.
// AI : Lovable-style page with no run widget — attach a pipeline later to insert {{run}}.
export const DEFAULT_HOSTED_SITE_LANDING_HTML = `<nav class="hs-nav">
  <div class="hs-nav-brand">
    {{logo}}
    <span class="hs-nav-name">{{company}}</span>
  </div>
  <div class="hs-nav-links">
    <a class="hs-nav-link" href="#top">Home</a>
    <span class="hs-nav-account">{{email}}</span>
  </div>
</nav>
<header class="hs-hero" id="top">
  <p class="hs-kicker">Your product</p>
  <h1 class="hs-title">{{company}}</h1>
  <p class="hs-lede">{{tagline}}</p>
</header>
<section class="hs-features" aria-label="Product">
  <article class="hs-feature">
    <p class="hs-feature-kicker">01</p>
    <h2>Start with the page</h2>
    <p>Describe the product in chat. Layout, copy, and brand are yours — no pipeline required.</p>
  </article>
  <article class="hs-feature">
    <p class="hs-feature-kicker">02</p>
    <h2>Add a pipeline when you need it</h2>
    <p>Attach a typed run later. The page stays a real website either way.</p>
  </article>
  <article class="hs-feature">
    <p class="hs-feature-kicker">03</p>
    <h2>Hosted for you</h2>
    <p>We host the page. You vibe the HTML. Sign-in and pay slots stay available when you want them.</p>
  </article>
</section>
<footer class="hs-footer">
  <span>{{company}}</span>
  <span class="hs-footer-meta">Hosted website</span>
</footer>
`

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
.hs-workspace-title { margin: 0.4rem 0 0; font-size: 1.25rem; font-weight: 650; letter-spacing: -0.025em; }
.hs-run-slot, .hs-output-slot, .hs-chatbot-slot, .hs-docs-slot { margin: 0 auto; max-width: 56rem; border-radius: 1.1rem; overflow: hidden; border: 1px solid color-mix(in srgb, var(--hs-fg) 10%, transparent); box-shadow: 0 22px 60px color-mix(in srgb, var(--hs-fg) 12%, transparent); background: #fff; color: inherit; }
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
@media (max-width: 720px) {
  .hs-features { grid-template-columns: 1fr; }
  .hs-hero { padding: 2.6rem 1.15rem 1.6rem; }
  .hs-nav { padding: 0.75rem 1rem; }
  .hs-nav-link { display: none; }
}
`
}
