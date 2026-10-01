import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { CartProvider } from "@/components/member/cart-provider";
import { loadContext } from "@/src/server/context";

const memberNav = [
  { href: "/dashboard", label: "Supplies" },
  { href: "/cart", label: "Request cart" },
  { href: "/requests", label: "My requests" },
  { href: "/checked-out", label: "Checked out" },
  { href: "/account", label: "Account" },
];

const adminNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/checked-out", label: "Checked out" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/users", label: "Users / Access" },
  { href: "/admin/history", label: "History" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function MainLayout({ children }: { children: ReactNode }) {
  const { user, store } = await loadContext();
  return (
    <CartProvider>
      <AppShell
        siteName={store.settings.siteName}
        personName={user.displayName}
        audience={user.role}
        items={user.role === "admin" ? adminNav : memberNav}
      >
        {children}
      </AppShell>
    </CartProvider>
  );
}
