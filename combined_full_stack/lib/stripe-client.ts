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

// AI : Checkout Sessions redirect — stripe-js v4+ dropped redirectToCheckout; assign URL directly.
export function redirectToCheckout(url: string): void {
  window.location.assign(url);
}
