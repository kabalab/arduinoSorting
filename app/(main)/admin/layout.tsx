import type { ReactNode } from "react";
import { requireAdmin } from "@/src/server/context";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
