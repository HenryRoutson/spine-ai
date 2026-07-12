// AI : credit-based billing (stripe.md):
//   - $5/mo subscription = recurring card billing, grants $5 of credit
//   - "Use 50c" button burns credit; $1 top up available when credit runs out
//   - hard cap on total billing for the whole app (BILLING_CAP_CENTS)
// AI : credits are granted by verifying the Checkout session on the success
//   redirect (idempotent via creditedSessions). Monthly *renewal* credits need
//   `stripe listen` webhooks — TODO placeholder for now.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PORT = 4242;
const BASE_URL = `http://localhost:${PORT}`;
const USE_COST_CENTS = 50;
const TOPUP_CENTS = 100;
const SUB_CENTS_PER_MONTH = 500;
const BILLING_CAP_CENTS = 2000; // AI : total the app may ever bill this card

// AI : type State = { balanceCents: number, totalBilledCents: number,
//   subscribed: boolean, creditedSessions: string[] }
const STATE_FILE = path.join(import.meta.dirname, "state.json");
const loadState = () =>
  fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
    : { balanceCents: 0, totalBilledCents: 0, subscribed: false, creditedSessions: [] };
const saveState = (/** @type {object} */ state) =>
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const dollars = (/** @type {number} */ cents) => `$${(cents / 100).toFixed(2)}`;

const page = (/** @type {string} */ banner, /** @type {object} */ state) => {
  const capReached = state.totalBilledCents >= BILLING_CAP_CENTS;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Pipeline Builder — Billing</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #0f1117; color: #e6e6e6; }
    .card { background: #1a1d26; padding: 2.5rem 3rem; border-radius: 12px; text-align: center; border: 1px solid #2a2e3a; min-width: 22rem; }
    .balance { font-size: 2.5rem; font-weight: 700; margin: 0.5rem 0 1.5rem; }
    button { background: #635bff; color: white; border: 0; padding: 0.8rem 2rem; border-radius: 8px; font-size: 1rem; cursor: pointer; width: 100%; margin-top: 0.6rem; }
    button:hover { background: #7a73ff; }
    button.secondary { background: #2a2e3a; }
    button.secondary:hover { background: #3a3f4f; }
    button:disabled { background: #2a2e3a; color: #666; cursor: not-allowed; }
    .banner { margin-bottom: 1rem; font-weight: 600; }
    .ok { color: #4ade80; } .bad { color: #f87171; }
    .hint { color: #888; font-size: 0.8rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    ${banner}
    <h1>AI Pipeline Builder</h1>
    <div>Credit balance</div>
    <div class="balance">${dollars(state.balanceCents)}</div>
    <form action="/use" method="POST">
      <button type="submit" ${state.balanceCents < USE_COST_CENTS ? "disabled" : ""}>Run pipeline — use ${dollars(USE_COST_CENTS)} credit</button>
    </form>
    <form action="/subscribe" method="POST">
      <button type="submit" class="secondary" ${state.subscribed || capReached ? "disabled" : ""}>${state.subscribed ? `Subscribed — ${dollars(SUB_CENTS_PER_MONTH)}/mo` : `Subscribe ${dollars(SUB_CENTS_PER_MONTH)}/mo (grants ${dollars(SUB_CENTS_PER_MONTH)} credit)`}</button>
    </form>
    <form action="/topup" method="POST">
      <button type="submit" class="secondary" ${capReached ? "disabled" : ""}>Top up ${dollars(TOPUP_CENTS)}</button>
    </form>
    <p class="hint">Billed ${dollars(state.totalBilledCents)} of ${dollars(BILLING_CAP_CENTS)} app billing cap${capReached ? " — cap reached, billing disabled" : ""}</p>
    <p class="hint">Test card: 4242 4242 4242 4242, any future date, any CVC</p>
  </div>
</body>
</html>`;
};

// AI : shared Checkout creator; one-time top up and monthly sub differ only in line_items
const checkout = async (/** @type {Stripe.Checkout.SessionCreateParams.Mode} */ mode, /** @type {object} */ lineItem) =>
  stripe.checkout.sessions.create({
    mode,
    line_items: [{ ...lineItem, quantity: 1 }],
    success_url: `${BASE_URL}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/?canceled=1`,
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const state = loadState();
  const redirect = (/** @type {string} */ to) => res.writeHead(303, { Location: to }).end();

  if (req.method === "POST") {
    if (url.pathname === "/use") {
      if (state.balanceCents < USE_COST_CENTS) return redirect("/?nofunds=1");
      state.balanceCents -= USE_COST_CENTS;
      saveState(state);
      return redirect("/?used=1");
    }
    if (url.pathname === "/topup" || url.pathname === "/subscribe") {
      const amount = url.pathname === "/topup" ? TOPUP_CENTS : SUB_CENTS_PER_MONTH;
      if (state.totalBilledCents + amount > BILLING_CAP_CENTS) return redirect("/?capped=1");
      const session = await (url.pathname === "/topup"
        ? checkout("payment", {
            price_data: { currency: "usd", unit_amount: TOPUP_CENTS, product_data: { name: "Credit top up" } },
          })
        : checkout("subscription", {
            price_data: { currency: "usd", unit_amount: SUB_CENTS_PER_MONTH, recurring: { interval: "month" }, product_data: { name: "AI Pipeline Builder monthly" } },
          }));
      return redirect(session.url);
    }
  }

  // AI : success redirect -> verify with Stripe and credit once
  const sessionId = url.searchParams.get("session_id");
  let banner = "";
  if (sessionId && !state.creditedSessions.includes(sessionId)) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      state.balanceCents += session.amount_total;
      state.totalBilledCents += session.amount_total;
      state.creditedSessions.push(sessionId);
      if (session.mode === "subscription") state.subscribed = true;
      saveState(state);
      banner = `<div class="banner ok">Payment successful — ${dollars(session.amount_total)} credited.</div>`;
    }
  } else if (url.searchParams.has("used")) {
    banner = `<div class="banner ok">Pipeline run — ${dollars(USE_COST_CENTS)} of credit used.</div>`;
  } else if (url.searchParams.has("nofunds")) {
    banner = `<div class="banner bad">Not enough credit — top up or subscribe.</div>`;
  } else if (url.searchParams.has("capped")) {
    banner = `<div class="banner bad">App billing cap (${dollars(BILLING_CAP_CENTS)}) reached — no further charges allowed.</div>`;
  } else if (url.searchParams.has("canceled")) {
    banner = `<div class="banner bad">Payment canceled.</div>`;
  }
  res.writeHead(200, { "Content-Type": "text/html" }).end(page(banner, state));
});

server.listen(PORT, () => console.log(`Billing UI -> ${BASE_URL}`));
