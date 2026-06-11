"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

// AI : browser Stripe.js loader — publishable key is inlined by Next from NEXT_PUBLIC_*.
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing");
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

// AI : Checkout Sessions redirect — redirectToCheckout was removed in stripe-js v4+.
export async function redirectToCheckout(url: string): Promise<void> {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe.js failed to load");
  window.location.href = url;
}
