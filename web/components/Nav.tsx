"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/used-parts", label: "سوق التشاليح" },
  { href: "/invoices", label: "الفواتير" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="row" style={{ marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              color: active ? "var(--accent)" : "var(--muted)",
              fontWeight: active ? 700 : 600,
              textDecoration: "none",
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
