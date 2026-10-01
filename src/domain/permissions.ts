import type { EquipmentRequest, Group, Item, User } from "./types";

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

export function canViewRequest(user: User, request: EquipmentRequest): boolean {
  if (isAdmin(user)) return true;
  return request.requesterId === user.id;
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
