"use server";

import { revalidatePath } from "next/cache";
import { generateAccessCode, hashAccessCode } from "@/src/auth/codes";
import { getRepository } from "@/src/data";
import {
  addAccessCode as addAccessCodeRecord,
  createGroup,
  removeAccessCode as removeAccessCodeRecord,
  renameAccessCode as renameAccessCodeRecord,
  replaceAccessCode,
  updateGroup,
  updateSettings,
} from "@/src/domain";
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
    membersCanReturn: formData.get("membersCanReturn") === "yes",
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

export async function addAccessCode(_previous: CodeResult | null, formData: FormData): Promise<CodeResult> {
  const { user } = await loadContext();
  const groupId = String(formData.get("groupId") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const accessCode = generateAccessCode();
  const codeHash = await hashAccessCode(accessCode);
  const result = await getRepository().update<CodeResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = addAccessCodeRecord(store, actor, groupId, displayName, accessCode, codeHash);
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return {
      store: outcome.value.store,
      result: {
        ok: true,
        message: "Access code created. It stays saved so you can view it again.",
        accessCode,
        person: outcome.value.user.displayName,
      },
    };
  });
  if (result.ok) refresh();
  return result;
}

export async function revealAccessCode(userId: string): Promise<CodeResult> {
  const { user } = await loadContext();
  const store = await getRepository().read();
  const actor = store.users.find((entry) => entry.id === user.id);
  if (!actor || actor.role !== "admin") return { ok: false, error: "You do not have permission to do that." };
  const person = store.users.find((entry) => entry.id === userId);
  if (!person) return { ok: false, error: "That person was not found." };
  const credential = store.credentials.find((entry) => entry.userId === userId);
  if (!credential) return { ok: false, error: "That access code was not found." };
  if (!credential.code) {
    return {
      ok: true,
      message: "This code was saved before it could be shown again. Rotate it once. The new code is saved so you can see it later.",
      accessCode: "",
      person: person.displayName,
    };
  }
  return {
    ok: true,
    message: "This is the current access code.",
    accessCode: credential.code,
    person: person.displayName,
  };
}

export async function rotateAccessCode(userId: string): Promise<CodeResult> {
  const { user } = await loadContext();
  const accessCode = generateAccessCode();
  const codeHash = await hashAccessCode(accessCode);
  const result = await getRepository().update<CodeResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const person = store.users.find((entry) => entry.id === userId);
    if (!person) return { store, result: { ok: false, error: "That person was not found." } };
    const outcome = replaceAccessCode(store, actor, userId, accessCode, codeHash);
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return {
      store: outcome.value,
      result: {
        ok: true,
        message: "Access code rotated. The new code is saved so you can view it again.",
        accessCode,
        person: person.displayName,
      },
    };
  });
  if (result.ok) refresh();
  return result;
}

export async function renameAccessCode(userId: string, displayName: string): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = renameAccessCodeRecord(store, actor, userId, displayName);
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Name saved." } };
  });
  if (result.ok) refresh();
  return result;
}

export async function removeAccessCode(userId: string): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = removeAccessCodeRecord(store, actor, userId);
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Access code removed." } };
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
