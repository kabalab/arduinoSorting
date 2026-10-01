"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/src/actions/auth";
import type { HelpAudience } from "@/src/content/help";
import { HelpButton } from "@/components/help/help-button";
import { useCart } from "@/components/member/cart-provider";
import { Button, buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

type NavItem = { href: string; label: string; count?: number };

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  siteName,
  personName,
  audience,
  items,
  children,
}: {
  siteName: string;
  personName: string;
  audience: HelpAudience;
  items: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuOpen = openPath === pathname;
  const cart = useCart();

  const links = items.map((item) => (item.href === "/cart" ? { ...item, count: cart.count } : item));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-stroke bg-card md:flex md:flex-col">
        <div className="border-b border-stroke px-4 py-5">
          <p className="text-xs tracking-wide text-muted uppercase">Equipment</p>
          <p className="mt-1 font-semibold">{siteName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-stroke px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={buttonClass("secondary", "md:hidden")}
              aria-expanded={menuOpen}
              onClick={() => setOpenPath(menuOpen ? null : pathname)}
            >
              Menu
            </button>
            <p className="font-semibold md:hidden">{siteName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline">{personName}</span>
            <form action={logout}>
              <Button type="submit" variant="secondary">
                Log out
              </Button>
            </form>
            <HelpButton audience={audience} />
          </div>
        </header>
        {menuOpen ? (
          <nav className="space-y-1 border-b border-stroke bg-card p-3 md:hidden">
            {links.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </nav>
        ) : null}
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
        active ? "bg-accent text-white" : "text-muted hover:bg-card-muted hover:text-text",
      )}
    >
      <span>{item.label}</span>
      {item.count ? <span className={cn("rounded-full px-2 text-xs", active ? "bg-white/20" : "bg-card-muted text-text")}>{item.count}</span> : null}
    </Link>
  );
}
