import type { EquipmentRequest, Group, Item, StoreData, User } from "./types";

export function isAdmin(user: User): boolean {
  return user.role === "admin";
}

export function permissionError(user: User): string | null {
  return isAdmin(user) ? null : "You do not have permission to do that.";
}

export function canRequestItem(item: Item, groupId: string): boolean {
  return !item.requestBlacklist.includes(groupId);
}

export function visibleItems(items: Item[], groupId: string): Item[] {
  return items.filter((item) => canRequestItem(item, groupId));
}

export function isAdminIssuedCheckout(store: StoreData, request: EquipmentRequest): boolean {
  const requester = store.users.find((user) => user.id === request.requesterId);
  if (!requester) return false;
  if (requester.role === "admin") return true;
  return store.groups.some((group) => group.id === requester.groupId && group.grantsAdmin);
}

export function memberCanSeeCheckout(store: StoreData, user: User, request: EquipmentRequest): boolean {
  if (request.requesterId === user.id) return true;
  return request.groupId === user.groupId && isAdminIssuedCheckout(store, request);
}

export function canViewRequest(store: StoreData, user: User, request: EquipmentRequest): boolean {
  if (isAdmin(user)) return true;
  return memberCanSeeCheckout(store, user, request);
}

export function canReturnRequest(store: StoreData, actor: User, request: EquipmentRequest): string | null {
  if (isAdmin(actor)) return null;
  if (request.groupId !== actor.groupId || !memberCanSeeCheckout(store, actor, request)) {
    return "You do not have permission to do that.";
  }
  const group = store.groups.find((entry) => entry.id === actor.groupId);
  if (!group?.membersCanReturn) return "You do not have permission to do that.";
  return null;
}

export function restrictionText(item: Item, groups: Group[]): string {
  if (item.requestBlacklist.length === 0) return "Anyone can request this";
  const names = item.requestBlacklist.map(
    (groupId) => groups.find((group) => group.id === groupId)?.name ?? "Unknown group",
  );
  if (names.length === 1) return `Hidden from ${names[0]}`;
  if (names.length === 2) return `Hidden from ${names[0]} and ${names[1]}`;
  return `Hidden from ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
