"use client";

// AI : Checkout is a hosted Stripe URL — do not import @stripe/stripe-js here.
// AI : The default entry injects js.stripe.com on module load (hidden iframes +
// AI : Permissions-Policy console noise) as soon as Billing is prefetched.

export function redirectToCheckout(url: string): void {
  window.location.assign(url);
}
