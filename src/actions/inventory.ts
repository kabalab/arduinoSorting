"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/src/data";
import { adjustAvailable, createItem, removeItem, updateItem } from "@/src/domain";
import type { ActionResult } from "./result";
import { loadContext } from "@/src/server/context";

function refresh() {
  revalidatePath("/", "layout");
}

export async function addSupply(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { user } = await loadContext();
  const blacklist = formData.getAll("blacklist").map(String);
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = createItem(
      store,
      actor,
      {
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? ""),
        imageUrl: String(formData.get("imageUrl") ?? ""),
        requestBlacklist: blacklist,
        available: Number(formData.get("available") ?? 0),
      },
      new Date(),
    );
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Supply added." } };
  });
  if (result.ok) refresh();
  return result;
}

export async function saveSupply(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { user } = await loadContext();
  const itemId = String(formData.get("itemId") ?? "");
  const blacklist = formData.getAll("blacklist").map(String);
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = updateItem(store, actor, itemId, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      requestBlacklist: blacklist,
    });
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Supply saved." } };
  });
  if (result.ok) refresh();
  return result;
}

export async function changeQuantity(itemId: string, delta: number): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = adjustAvailable(store, actor, itemId, delta, new Date());
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Quantity updated." } };
  });
  if (result.ok) refresh();
  return result;
}

export async function deleteSupply(itemId: string): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = removeItem(store, actor, itemId, new Date());
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Supply removed. Its history is still in the ledger." } };
  });
  if (result.ok) refresh();
  return result;
}
