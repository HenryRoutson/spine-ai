"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LEGAL, LEGAL_ROUTES } from "@shared/legal/site";

const STORAGE_KEY = `landing_demo_privacy_${LEGAL.policyVersion}`;

export function readDemoPrivacyConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "yes";
}

export function writeDemoPrivacyConsent(): void {
  localStorage.setItem(STORAGE_KEY, "yes");
}

type LandingDemoConsentBannerProps = {
  visible: boolean;
  nudge: boolean;
  onAccept: () => void;
};

export function LandingDemoConsentBanner({ visible, nudge, onAccept }: LandingDemoConsentBannerProps) {
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!nudge || !visible) return;
    acceptRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    acceptRef.current?.focus();
  }, [nudge, visible]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Demo privacy consent"
      className="fixed bottom-0 inset-x-0 z-[55] border-t border-line bg-background/95 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted">
          Generate sends your task to an AI provider. We also record a session replay of this page
          (clicks and typing) to debug the demo. Details in our{" "}
          <Link href={LEGAL_ROUTES.privacy} className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          ref={acceptRef}
          type="button"
          className={`zeero-btn shrink-0 text-xs${nudge ? " landing-demo-consent-accept-nudge" : ""}`}
          onClick={onAccept}
        >
          I accept
        </button>
      </div>
    </div>
  );
}
