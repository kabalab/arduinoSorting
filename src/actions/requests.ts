"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/src/data";
import { approveRequest, cancelRequest, denyRequest, returnItems, submitRequest, type QuantityLine } from "@/src/domain";
import { loadContext } from "@/src/server/context";
import type { ActionResult } from "./result";

function refresh() {
  revalidatePath("/", "layout");
}

export async function submitCart(lines: QuantityLine[], expectedReturn: string): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = submitRequest(store, actor, { lines, expectedReturn }, new Date());
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    const created = outcome.value.requests.at(-1);
    const message =
      created?.status === "checked_out"
        ? "Request submitted and checked out."
        : "Request submitted. It is pending approval.";
    return { store: outcome.value, result: { ok: true, message } };
  });
  if (result.ok) refresh();
  return result;
}

export async function cancelOwnRequest(requestId: string): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = cancelRequest(store, actor, requestId);
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Request cancelled." } };
  });
  if (result.ok) refresh();
  return result;
}

export async function approvePending(requestId: string): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = approveRequest(store, actor, requestId, new Date());
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Request approved and checked out." } };
  });
  if (result.ok) refresh();
  return result;
}

export async function denyPending(requestId: string, reason: string): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = denyRequest(store, actor, requestId, reason);
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    return { store: outcome.value, result: { ok: true, message: "Request denied." } };
  });
  if (result.ok) refresh();
  return result;
}

export async function markReturned(requestId: string, lines: QuantityLine[]): Promise<ActionResult> {
  const { user } = await loadContext();
  const result = await getRepository().update<ActionResult>((store) => {
    const actor = store.users.find((entry) => entry.id === user.id);
    if (!actor) return { store, result: { ok: false, error: "Your session expired. Sign in again." } };
    const outcome = returnItems(store, actor, requestId, lines, new Date());
    if (!outcome.ok) return { store, result: { ok: false, error: outcome.error } };
    const request = outcome.value.requests.find((entry) => entry.id === requestId);
    const message = request?.status === "returned" ? "All items returned." : "Partial return recorded.";
    return { store: outcome.value, result: { ok: true, message } };
  });
  if (result.ok) refresh();
  return result;
}
