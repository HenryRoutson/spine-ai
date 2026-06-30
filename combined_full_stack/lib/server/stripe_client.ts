import Stripe from "stripe";
import { STRIPE_ENABLED } from "@/lib/stripe-enabled";

// AI : server-only Stripe client — secret key from repo root .env (stripe/stripe.js).
let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!STRIPE_ENABLED) throw new Error("Stripe is disabled (NEXT_PUBLIC_STRIPE_ENABLED != true)");
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing — set it in the repo root .env");
  stripe ??= new Stripe(key);
  return stripe;
}
