"use server";

import { redirect } from "next/navigation";
import { verifyAccessCode } from "@/src/auth/codes";
import { clearSession, setSession } from "@/src/auth/session";
import { getRepository } from "@/src/data";
import type { ActionResult } from "./result";

export async function login(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { ok: false, error: "Enter your access code." };

  const store = await getRepository().read();
  let matched: (typeof store.users)[number] | null = null;
  for (const credential of store.credentials) {
    if (await verifyAccessCode(code, credential.codeHash)) {
      matched = store.users.find((user) => user.id === credential.userId) ?? matched;
    }
  }
  if (!matched) return { ok: false, error: "That access code is not recognized." };

  const group = store.groups.find((entry) => entry.id === matched.groupId);
  const role = group?.grantsAdmin ? "admin" : "member";
  await setSession(matched.id, role);
  redirect(role === "admin" ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
