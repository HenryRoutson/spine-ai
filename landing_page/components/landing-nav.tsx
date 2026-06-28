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
        <a href="#" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center border border-line-bright bg-panel">
            <span className="font-mono text-sm font-medium text-foreground">|</span>
          </div>
          <span className="hidden text-sm font-medium sm:inline">auto pipeline</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link: NavLink) => (
            <a key={link.href} href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </div>

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
          </div>
        </div>
      ) : null}
    </header>
  );
}
