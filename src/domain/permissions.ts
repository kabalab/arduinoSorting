import type { ApprovalMode, EquipmentRequest, Group, Item, StoreData, User } from "./types";

export function isAdmin(user: User): boolean {
  return user.role === "admin";
}

/** True when this administrator is the original one, or when no original has been marked yet. */
export function isPrimaryAdmin(store: StoreData, actor: User): boolean {
  if (!isAdmin(actor)) return false;
  if (actor.primaryAdmin) return true;
  return !store.users.some((user) => user.primaryAdmin);
}

export function addCodeError(store: StoreData, actor: User, groupId: string): string | null {
  const group = store.groups.find((entry) => entry.id === groupId);
  if (!group) return "That group was not found.";
  if (isAdmin(actor)) return null;
  if (actor.groupAdmin && actor.groupId === group.id && !group.grantsAdmin) return null;
  return "You do not have permission to do that.";
}

export function manageCodeError(
  store: StoreData,
  actor: User,
  targetId: string,
  action: "reveal" | "rotate" | "rename" | "remove",
): string | null {
  const target = store.users.find((user) => user.id === targetId);
  if (!target) return "That person was not found.";
  if (!store.credentials.some((credential) => credential.userId === targetId)) {
    return "That access code was not found.";
  }

  if (isAdmin(actor)) {
    const primary = isPrimaryAdmin(store, actor);
    const targetIsOriginal = Boolean(target.primaryAdmin);
    if (!primary && targetIsOriginal && action !== "rename") {
      return action === "reveal"
        ? "You cannot view the original administrator's code."
        : "You cannot change the original administrator's code.";
    }
    if (!primary && actor.id === target.id && (action === "rotate" || action === "remove")) {
      return "You cannot change your own access code.";
    }
    if (!primary && action === "remove" && target.role === "admin") return "You cannot remove an administrator.";
    return null;
  }

  if (!actor.groupAdmin) return "You do not have permission to do that.";
  if (actor.groupId !== target.groupId) return "You can only change people in your group.";
  const group = store.groups.find((entry) => entry.id === target.groupId);
  if (!group || group.grantsAdmin) return "You do not have permission to do that.";
  if (action === "remove") return "You do not have permission to do that.";
  return null;
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

export function canDecideRequest(actor: User, request: EquipmentRequest): string | null {
  if (isAdmin(actor)) return null;
  if (actor.groupAdmin && actor.groupId === request.groupId) return null;
  return "You do not have permission to do that.";
}

export function grantCeilingError(
  actor: User,
  target: User,
  draft: { approvalMode: ApprovalMode; canReturn: boolean },
): string | null {
  if (isAdmin(actor)) return null;
  if (!actor.groupAdmin) return "You do not have permission to do that.";
  if (draft.approvalMode === "automatic" && actor.approvalMode !== "automatic" && target.approvalMode !== "automatic") {
    return "You can only give permissions you have. Your requests require approval.";
  }
  if (draft.canReturn && !actor.canReturn && !target.canReturn) {
    return "You can only give permissions you have. You cannot mark items returned.";
  }
  return null;
}

export function canReturnRequest(store: StoreData, actor: User, request: EquipmentRequest): string | null {
  if (isAdmin(actor)) return null;
  if (request.groupId !== actor.groupId || !memberCanSeeCheckout(store, actor, request)) {
    return "You do not have permission to do that.";
  }
  if (!actor.canReturn) return "You do not have permission to do that.";
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
