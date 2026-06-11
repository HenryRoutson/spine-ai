import Stripe from "stripe";

// AI : server-only Stripe client — secret key from repo root .env (stripe/stripe.js).
let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing — set it in the repo root .env");
  stripe ??= new Stripe(key);
  return stripe;
}
