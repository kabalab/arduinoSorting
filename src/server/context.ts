import { redirect } from "next/navigation";
import { getSession } from "@/src/auth/session";
import { getRepository } from "@/src/data";
import type { StoreData, User } from "@/src/domain/types";

export async function loadContext(): Promise<{ user: User; store: StoreData }> {
  const session = await getSession();
  if (!session) redirect("/");
  const store = await getRepository().read();
  const user = store.users.find((entry) => entry.id === session.userId);
  const credential = store.credentials.find((entry) => entry.userId === session.userId);
  if (!user || !credential || credential.codeHash !== session.codeHash) {
    redirect("/session/end");
  }
  return { user, store };
}

export async function requireGroupAdmin(): Promise<{ user: User; store: StoreData }> {
  const context = await loadContext();
  if (context.user.role === "admin") redirect("/admin/groups");
  if (!context.user.groupAdmin) redirect("/dashboard");
  return context;
}

export async function requireAdmin(): Promise<{ user: User; store: StoreData }> {
  const context = await loadContext();
  if (context.user.role !== "admin") redirect("/dashboard");
  return context;
}
