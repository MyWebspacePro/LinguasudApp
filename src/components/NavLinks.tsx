"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Hauptnavigation mit aktiver Markierung. Optimiert für die dunkle
 * Bordeaux-Sidebar (deshalb nur innerhalb eines `bg-brand-800`-Containers
 * einsetzen): helle Schrift, aktiver Eintrag als weisse Fläche mit Schatten
 * (moderner «Pill»-Stil), inaktive Einträge ruhig und gut lesbar.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active =
          pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "block rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-800 shadow-sm"
                : "block rounded-lg px-3 py-1.5 text-sm font-medium text-brand-100 transition hover:bg-white/10 hover:text-white"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
