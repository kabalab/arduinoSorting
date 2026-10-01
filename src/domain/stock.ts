import { exactNameMatch } from "./names";
import { fail, itemTotal, type Item, type Result, type StoreData, type User } from "./types";
import { permissionError } from "./permissions";

export type ItemDraft = {
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  requestBlacklist: string[];
  available: number;
};

function cleanText(value: string): string {
  return value.trim();
}

function isSafeImageUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateItemDraft(
  store: StoreData,
  draft: ItemDraft,
  exceptId?: string,
): string | null {
  const name = cleanText(draft.name);
  const category = cleanText(draft.category);
  if (!name) return "Enter a name.";
  if (!category) return "Enter a category.";
  if (!Number.isInteger(draft.available) || draft.available < 0) {
    return "Available quantity cannot go below zero.";
  }
  if (!isSafeImageUrl(draft.imageUrl.trim())) {
    return "Image address must start with http:// or https://.";
  }
  if (exactNameMatch(name, store.items, exceptId)) {
    return `${name} already exists. Open that supply instead of creating a second one.`;
  }
  const knownGroups = new Set(store.groups.map((group) => group.id));
  if (draft.requestBlacklist.some((groupId) => !knownGroups.has(groupId))) {
    return "One of the selected groups was not found.";
  }
  return null;
}

export function createItem(
  store: StoreData,
  actor: User,
  draft: ItemDraft,
  now: Date,
): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const error = validateItemDraft(store, draft);
  if (error) return fail(error);

  const next = structuredClone(store);
  const item: Item = {
    id: crypto.randomUUID(),
    name: cleanText(draft.name),
    description: cleanText(draft.description),
    category: cleanText(draft.category),
    imageUrl: draft.imageUrl.trim(),
    requestBlacklist: [...new Set(draft.requestBlacklist)],
    available: draft.available,
    checkedOut: 0,
  };
  next.items.push(item);
  next.ledger.push({
    id: crypto.randomUUID(),
    itemId: item.id,
    itemName: item.name,
    delta: item.available,
    kind: "added",
    actorId: actor.id,
    at: now.toISOString(),
  });
  return { ok: true, value: next };
}

export function updateItem(
  store: StoreData,
  actor: User,
  itemId: string,
  draft: Omit<ItemDraft, "available">,
): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const existing = store.items.find((item) => item.id === itemId);
  if (!existing) return fail("That supply was not found.");
  const error = validateItemDraft(store, { ...draft, available: existing.available }, itemId);
  if (error) return fail(error);

  const next = structuredClone(store);
  const item = next.items.find((entry) => entry.id === itemId);
  if (!item) return fail("That supply was not found.");
  item.name = cleanText(draft.name);
  item.description = cleanText(draft.description);
  item.category = cleanText(draft.category);
  item.imageUrl = draft.imageUrl.trim();
  item.requestBlacklist = [...new Set(draft.requestBlacklist)];
  return { ok: true, value: next };
}

export function adjustAvailable(
  store: StoreData,
  actor: User,
  itemId: string,
  delta: number,
  now: Date,
): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  if (!Number.isInteger(delta) || delta === 0) return fail("Choose a quantity change.");
  const existing = store.items.find((item) => item.id === itemId);
  if (!existing) return fail("That supply was not found.");
  const available = existing.available + delta;
  if (available < 0) return fail("Available quantity cannot go below zero.");

  const next = structuredClone(store);
  const item = next.items.find((entry) => entry.id === itemId);
  if (!item) return fail("That supply was not found.");
  item.available = available;
  next.ledger.push({
    id: crypto.randomUUID(),
    itemId: item.id,
    itemName: item.name,
    delta,
    kind: "adjusted",
    actorId: actor.id,
    at: now.toISOString(),
  });
  return { ok: true, value: next };
}

export function removeItem(
  store: StoreData,
  actor: User,
  itemId: string,
  now: Date,
): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const existing = store.items.find((item) => item.id === itemId);
  if (!existing) return fail("That supply was not found.");
  if (existing.checkedOut > 0) {
    return fail("This supply is still checked out. Return every unit before removing it.");
  }

  const next = structuredClone(store);
  const item = next.items.find((entry) => entry.id === itemId);
  if (!item) return fail("That supply was not found.");
  if (item.available > 0) {
    next.ledger.push({
      id: crypto.randomUUID(),
      itemId: item.id,
      itemName: item.name,
      delta: -item.available,
      kind: "removed",
      actorId: actor.id,
      at: now.toISOString(),
    });
  }
  next.items = next.items.filter((entry) => entry.id !== itemId);
  return { ok: true, value: next };
}

export function assertStockInvariant(item: Item): string | null {
  if (item.available < 0 || item.checkedOut < 0) return "Quantities cannot go negative.";
  if (itemTotal(item) !== item.available + item.checkedOut) return "Total must equal available plus checked out.";
  return null;
}
