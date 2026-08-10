import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/app-shell/brand-mark";
import { MobileNav } from "@/components/app-shell/mobile-nav";

type AppShellProps = Readonly<{
  children: ReactNode;
}>;

const DESKTOP_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/anchor", label: "Anchor lab" },
  { href: "/my-maps", label: "My maps" },
] as const;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label="Field Atlas home">
            <BrandMark />
            <span className="brand__wordmark">
              Field Atlas
              <span className="brand__microcopy">Any map · live position</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {DESKTOP_LINKS.map((link) => (
              <Link className="desktop-nav__link" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>

          <Link className="button button--signal site-header__action" href={"/anchor/new" as Route}>
            Start a map
          </Link>
        </div>
      </header>
      {children}
      <MobileNav />
    </div>
  );
}
