import { isDateOnly, todayDateString } from "./overdue";
import { canDecideRequest, canRequestItem, canReturnRequest, permissionError } from "./permissions";
import {
  fail,
  lineOutstanding,
  type EquipmentRequest,
  type RequestLine,
  type Result,
  type StoreData,
  type User,
} from "./types";

export type QuantityLine = {
  itemId: string;
  quantity: number;
};

function groupOf(store: StoreData, user: User) {
  return store.groups.find((group) => group.id === user.groupId) ?? null;
}

function mergeLines(lines: QuantityLine[]): Map<string, number> | string {
  const merged = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return "Quantity must be at least 1.";
    }
    merged.set(line.itemId, (merged.get(line.itemId) ?? 0) + line.quantity);
  }
  if (merged.size === 0) return "Add at least one supply.";
  return merged;
}

function expectedReturnError(expectedReturn: string, now: Date): string | null {
  if (!expectedReturn.trim()) return "Enter an expected return date.";
  if (!isDateOnly(expectedReturn) || expectedReturn < todayDateString(now)) {
    return "Choose an expected return date that is today or later.";
  }
  return null;
}

function availabilityError(store: StoreData, groupId: string | null, merged: Map<string, number>): string | null {
  for (const [itemId, quantity] of merged) {
    const item = store.items.find((entry) => entry.id === itemId);
    if (!item) return "A selected supply was not found.";
    if (groupId && !canRequestItem(item, groupId)) return `Your group cannot request ${item.name}.`;
    if (quantity > item.available) {
      const verb = item.available === 1 ? "is" : "are";
      return `Only ${item.available} ${item.name} ${verb} available.`;
    }
  }
  return null;
}

export function cartSubmitError(
  store: StoreData,
  user: User,
  lines: QuantityLine[],
  expectedReturn: string,
  now: Date,
): string | null {
  const group = groupOf(store, user);
  if (!group) return "Your group was not found.";
  const dateError = expectedReturnError(expectedReturn, now);
  if (dateError) return dateError;
  const merged = mergeLines(lines);
  if (typeof merged === "string") return merged;
  return availabilityError(store, user.groupId, merged);
}

function checkoutLines(
  store: StoreData,
  merged: Map<string, number>,
  actorId: string,
  requestId: string,
  now: Date,
): RequestLine[] {
  const lines: RequestLine[] = [];
  for (const [itemId, quantity] of merged) {
    const item = store.items.find((entry) => entry.id === itemId);
    if (!item) continue;
    item.available -= quantity;
    item.checkedOut += quantity;
    store.ledger.push({
      id: crypto.randomUUID(),
      itemId,
      itemName: item.name,
      delta: -quantity,
      kind: "checked_out",
      actorId,
      at: now.toISOString(),
      requestId,
    });
    lines.push({
      itemId,
      quantityRequested: quantity,
      quantityCheckedOut: quantity,
      quantityReturned: 0,
    });
  }
  return lines;
}

export function submitRequest(
  store: StoreData,
  actor: User,
  input: { lines: QuantityLine[]; expectedReturn: string },
  now: Date,
): Result<StoreData> {
  const error = cartSubmitError(store, actor, input.lines, input.expectedReturn, now);
  if (error) return fail(error);
  const group = groupOf(store, actor);
  if (!group) return fail("Your group was not found.");
  const merged = mergeLines(input.lines);
  if (typeof merged === "string") return fail(merged);

  const next = structuredClone(store);
  const requestId = crypto.randomUUID();
  const automatic = actor.approvalMode === "automatic";
  const stamped = now.toISOString();
  const lines = automatic
    ? checkoutLines(next, merged, actor.id, requestId, now)
    : [...merged].map(([itemId, quantity]) => ({
        itemId,
        quantityRequested: quantity,
        quantityCheckedOut: 0,
        quantityReturned: 0,
      }));

  const request: EquipmentRequest = {
    id: requestId,
    groupId: actor.groupId,
    requesterId: actor.id,
    createdAt: stamped,
    expectedReturn: input.expectedReturn,
    status: automatic ? "checked_out" : "pending",
    lines,
  };
  if (automatic) {
    request.approvedAt = stamped;
    request.approvedBy = actor.id;
    request.checkedOutAt = stamped;
  }
  next.requests.push(request);
  return { ok: true, value: next };
}

export function adminCheckout(
  store: StoreData,
  actor: User,
  input: { groupId: string; lines: QuantityLine[]; expectedReturn: string },
  now: Date,
): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const group = store.groups.find((entry) => entry.id === input.groupId);
  if (!group) return fail("Choose a group.");
  const dateError = expectedReturnError(input.expectedReturn, now);
  if (dateError) return fail(dateError);
  const merged = mergeLines(input.lines);
  if (typeof merged === "string") return fail(merged);
  const stockError = availabilityError(store, null, merged);
  if (stockError) return fail(stockError);

  const next = structuredClone(store);
  const requestId = crypto.randomUUID();
  const stamped = now.toISOString();
  const request: EquipmentRequest = {
    id: requestId,
    groupId: group.id,
    requesterId: actor.id,
    createdAt: stamped,
    expectedReturn: input.expectedReturn,
    status: "checked_out",
    approvedAt: stamped,
    approvedBy: actor.id,
    checkedOutAt: stamped,
    lines: checkoutLines(next, merged, actor.id, requestId, now),
  };
  next.requests.push(request);
  return { ok: true, value: next };
}

export function approveRequest(
  store: StoreData,
  actor: User,
  requestId: string,
  now: Date,
): Result<StoreData> {
  const existing = store.requests.find((request) => request.id === requestId);
  if (!existing) return fail("That request was not found.");
  const denied = canDecideRequest(actor, existing);
  if (denied) return fail(denied);
  if (existing.status !== "pending") return fail("Only a pending request can be approved.");

  const merged = new Map(existing.lines.map((line) => [line.itemId, line.quantityRequested]));
  const stockError = availabilityError(store, existing.groupId, merged);
  if (stockError) return fail(stockError);

  const next = structuredClone(store);
  const request = next.requests.find((entry) => entry.id === requestId);
  if (!request) return fail("That request was not found.");
  const stamped = now.toISOString();
  request.lines = checkoutLines(next, merged, actor.id, request.id, now);
  request.status = "checked_out";
  request.approvedAt = stamped;
  request.approvedBy = actor.id;
  request.checkedOutAt = stamped;
  return { ok: true, value: next };
}

export function denyRequest(
  store: StoreData,
  actor: User,
  requestId: string,
  reason: string,
): Result<StoreData> {
  const existing = store.requests.find((request) => request.id === requestId);
  if (!existing) return fail("That request was not found.");
  const denied = canDecideRequest(actor, existing);
  if (denied) return fail(denied);
  if (existing.status !== "pending") return fail("Only a pending request can be denied.");

  const next = structuredClone(store);
  const request = next.requests.find((entry) => entry.id === requestId);
  if (!request) return fail("That request was not found.");
  request.status = "denied";
  const trimmed = reason.trim();
  if (trimmed) request.denialReason = trimmed;
  return { ok: true, value: next };
}

export function cancelRequest(store: StoreData, actor: User, requestId: string): Result<StoreData> {
  const existing = store.requests.find((request) => request.id === requestId);
  if (!existing) return fail("That request was not found.");
  if (existing.requesterId !== actor.id) return fail("You can only cancel your own request.");
  if (existing.status !== "pending") return fail("Only a pending request can be cancelled.");

  const next = structuredClone(store);
  const request = next.requests.find((entry) => entry.id === requestId);
  if (!request) return fail("That request was not found.");
  request.status = "cancelled";
  return { ok: true, value: next };
}

export function returnItems(
  store: StoreData,
  actor: User,
  requestId: string,
  quantities: QuantityLine[],
  now: Date,
): Result<StoreData> {
  const existing = store.requests.find((request) => request.id === requestId);
  if (!existing) return fail("That request was not found.");
  const denied = canReturnRequest(store, actor, existing);
  if (denied) return fail(denied);
  if (existing.status !== "checked_out") return fail("Only a checked-out request can be returned.");

  const merged = new Map<string, number>();
  for (const line of quantities) {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      return fail("Return quantity cannot go below zero.");
    }
    if (line.quantity === 0) continue;
    merged.set(line.itemId, (merged.get(line.itemId) ?? 0) + line.quantity);
  }
  if (merged.size === 0) return fail("Enter a quantity to return.");

  for (const [itemId, quantity] of merged) {
    const line = existing.lines.find((entry) => entry.itemId === itemId);
    if (!line) return fail("That supply is not on this request.");
    if (quantity > lineOutstanding(line)) {
      return fail("Return quantity cannot be more than what is still checked out.");
    }
  }

  const next = structuredClone(store);
  const request = next.requests.find((entry) => entry.id === requestId);
  if (!request) return fail("That request was not found.");
  const stamped = now.toISOString();

  for (const [itemId, quantity] of merged) {
    const line = request.lines.find((entry) => entry.itemId === itemId);
    const item = next.items.find((entry) => entry.id === itemId);
    if (!line || !item) return fail("That supply was not found.");
    line.quantityReturned += quantity;
    item.available += quantity;
    item.checkedOut -= quantity;
    next.ledger.push({
      id: crypto.randomUUID(),
      itemId,
      itemName: item.name,
      delta: quantity,
      kind: "returned",
      actorId: actor.id,
      at: stamped,
      requestId,
    });
  }

  const fullyReturned = request.lines.every((line) => line.quantityReturned >= line.quantityCheckedOut);
  if (fullyReturned) {
    request.status = "returned";
    request.returnedAt = stamped;
  }
  return { ok: true, value: next };
}
