"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = Readonly<{
  name: "discover" | "anchor" | "maps" | "account";
}>;

const LINKS = [
  { href: "/", label: "Discover", icon: "discover" },
  { href: "/anchor", label: "Anchor", icon: "anchor" },
  { href: "/my-maps", label: "My maps", icon: "maps" },
  { href: "/account", label: "Account", icon: "account" },
] as const;

function NavIcon({ name }: IconProps) {
  if (name === "account") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "anchor") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 2v5m0 10v5M2 12h5m10 0h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "maps") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 3v16m6-14v16" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m14.8 9.2-1.7 3.9-3.9 1.7 1.7-3.9Z" fill="currentColor" />
    </svg>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {LINKS.map((link) => {
        const isCurrent = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

        return (
          <Link
            className="mobile-nav__link"
            href={link.href}
            aria-current={isCurrent ? "page" : undefined}
            key={link.href}
          >
            <NavIcon name={link.icon} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
