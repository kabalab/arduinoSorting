"use server";

import { redirect } from "next/navigation";
import { verifyAccessCode } from "@/src/auth/codes";
import { clearSession, setSession } from "@/src/auth/session";
import { getRepository } from "@/src/data";
import { applyDefaultCodes, hashedDefaults, isResetCode } from "@/src/data/local/reset-code";
import type { ActionResult } from "./result";

export async function login(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { ok: false, error: "Enter your access code." };

  const store = await getRepository().read();
  if (await isResetCode(code)) return resetAccessCodes();
  let matched: (typeof store.users)[number] | null = null;
  let codeHash = "";
  for (const credential of store.credentials) {
    if (await verifyAccessCode(code, credential.codeHash)) {
      const user = store.users.find((entry) => entry.id === credential.userId);
      if (user) {
        matched = user;
        codeHash = credential.codeHash;
      }
    }
  }
  if (!matched || !codeHash) return { ok: false, error: "That access code is not recognized." };

  const group = store.groups.find((entry) => entry.id === matched.groupId);
  const role = group?.grantsAdmin ? "admin" : "member";
  await setSession(matched.id, role, codeHash);
  redirect(role === "admin" ? "/admin" : "/dashboard");
}

async function resetAccessCodes(): Promise<ActionResult> {
  const defaults = await hashedDefaults();
  if (!defaults) return { ok: false, error: "The original access codes are not available on this machine." };
  return getRepository().update((current) => {
    const applied = applyDefaultCodes(current, defaults);
    if (applied.restored === 0) {
      return {
        store: current,
        result: { ok: false, error: "None of the original access codes match a person in the store." },
      };
    }
    return {
      store: applied.store,
      result: {
        ok: true,
        message: "Access codes are back to their original values. Sign in with one of those codes.",
      },
    };
  });
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
