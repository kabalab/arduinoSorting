"use server";

import { revalidatePath } from "next/cache";
import { generateAccessCode, hashAccessCode } from "@/src/auth/codes";
import { getRepository } from "@/src/data";
import { createGroup, createUser, updateGroup, updateSettings, updateUser } from "@/src/domain";
import { loadContext } from "@/src/server/context";
import type { ActionResult, CodeResult } from "./result";

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveGroup(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { user } = await loadContext();
  const groupId = String(formData.get("groupId") ?? "");
  const input = {
    name: String(formData.get("name") ?? ""),
    approvalMode: String(formData.get("approvalMode") ?? ""),
  };
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = groupId ? updateGroup(store, actor, groupId, input) : createGroup(store, actor, input);
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: groupId ? "Group saved." : "Group created." } };
  });
  if (result.ok) refresh();
  return result;
}

export async function savePerson(_previous: CodeResult | null, formData: FormData): Promise<CodeResult> {
  const { user } = await loadContext();
  const userId = String(formData.get("userId") ?? "");
  const draft = {
    displayName: String(formData.get("displayName") ?? ""),
    role: String(formData.get("role") ?? ""),
    groupId: String(formData.get("groupId") ?? ""),
  };
  const accessCode = userId ? "" : generateAccessCode();
  const codeHash = accessCode ? await hashAccessCode(accessCode) : "";

  const result = await getRepository().update<CodeResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    if (userId) {
      const outcome = updateUser(store, actor, userId, draft);
      if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
      return {
        store: outcome.value,
        result: { ok: true, message: "Person saved.", accessCode: "", person: draft.displayName.trim() },
      };
    }
    const outcome = createUser(store, actor, draft);
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    const next = outcome.value.store;
    next.credentials.push({ userId: outcome.value.user.id, codeHash });
    return {
      store: next,
      result: {
        ok: true,
        message: "Person created. Copy the access code now. It will not be shown again.",
        accessCode,
        person: outcome.value.user.displayName,
      },
    };
  });
  if (result.ok) refresh();
  return result;
}

export async function rotateAccessCode(userId: string): Promise<CodeResult> {
  const { user } = await loadContext();
  const accessCode = generateAccessCode();
  const codeHash = await hashAccessCode(accessCode);
  const result = await getRepository().update<CodeResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor || actor.role !== "admin") {
      return { store, result: { ok: false, error: "You do not have permission to do that." } };
    }
    const person = store.users.find((entry) => entry.id === userId);
    if (!person) return { store, result: { ok: false, error: "That person was not found." } };
    const next = structuredClone(store);
    next.credentials = next.credentials.filter((credential) => credential.userId !== userId);
    next.credentials.push({ userId, codeHash });
    return {
      store: next,
      result: {
        ok: true,
        message: "Access code rotated. Copy it now. It will not be shown again.",
        accessCode,
        person: person.displayName,
      },
    };
  });
  if (result.ok) refresh();
  return result;
}

export async function saveSettings(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = updateSettings(store, actor, String(formData.get("siteName") ?? ""));
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Settings saved." } };
  });
  if (result.ok) refresh();
  return result;
}
