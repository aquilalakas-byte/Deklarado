"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, GearIcon, HomeIcon, ListIcon } from "./Icons";

const TABS = [
  { href: "/", label: "Today", Icon: HomeIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/browse", label: "Browse", Icon: ListIcon },
  { href: "/settings", label: "Settings", Icon: GearIcon },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${active ? "text-brand" : "text-muted hover:text-text"}`}
              >
                <Icon width={22} height={22} strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
