"use client";

import { useState } from "react";

type NavLink = { href: string; label: string };
type AppLoginUrl = string;

type LandingNavProps = {
  links: NavLink[];
  loginUrl: AppLoginUrl;
};

export function LandingNav({ links, loginUrl }: LandingNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3.5">
        <a href="#" className="spine-logo boxed" aria-label="Spine">
          <span className="spine-mark-wrap">
            <span className="spine-mark" aria-hidden="true">
              <span className="node" />
              <span className="node" />
              <span className="node" />
            </span>
          </span>
          <span className="spine-wordmark hidden sm:inline" style={{ fontSize: "14px" }}>Spine</span>
        </a>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-8 md:flex">
            {links.map((link: NavLink) => (
              <a key={link.href} href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={loginUrl}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Sign in
          </a>
          <button
            type="button"
            aria-label="Menu"
            className="flex flex-col gap-1.5 md:hidden"
            onClick={() => setOpen((v: boolean) => !v)}
          >
            <span className="h-px w-5 bg-foreground" />
            <span className="h-px w-5 bg-foreground" />
            <span className="h-px w-5 bg-foreground" />
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-line px-5 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link: NavLink) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a href={loginUrl} className="text-sm text-muted" onClick={() => setOpen(false)}>
              Sign in
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
