"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

/** Hauptnavigation mit aktiver Markierung. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active =
          pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "block rounded-md bg-brand-100 px-3 py-1.5 text-sm font-medium text-brand-900"
                : "block rounded-md px-3 py-1.5 text-sm text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
