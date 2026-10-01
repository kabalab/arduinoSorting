import { fail, type Group, type Result, type Role, type Settings, type StoreData, type User } from "./types";
import { permissionError } from "./permissions";

const APPROVAL_MODES = new Set(["automatic", "required"]);
const ROLES = new Set<Role>(["admin", "member"]);

export function createGroup(
  store: StoreData,
  actor: User,
  input: { name: string; approvalMode: string },
): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const name = input.name.trim();
  if (!name) return fail("Enter a group name.");
  if (!APPROVAL_MODES.has(input.approvalMode)) return fail("Choose an approval mode.");
  if (store.groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
    return fail("A group with that name already exists.");
  }
  const next = structuredClone(store);
  next.groups.push({
    id: crypto.randomUUID(),
    name,
    approvalMode: input.approvalMode as Group["approvalMode"],
  });
  return { ok: true, value: next };
}

export function updateGroup(
  store: StoreData,
  actor: User,
  groupId: string,
  input: { name: string; approvalMode: string },
): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const existing = store.groups.find((group) => group.id === groupId);
  if (!existing) return fail("That group was not found.");
  const name = input.name.trim();
  if (!name) return fail("Enter a group name.");
  if (!APPROVAL_MODES.has(input.approvalMode)) return fail("Choose an approval mode.");
  if (store.groups.some((group) => group.id !== groupId && group.name.toLowerCase() === name.toLowerCase())) {
    return fail("A group with that name already exists.");
  }
  const next = structuredClone(store);
  const group = next.groups.find((entry) => entry.id === groupId);
  if (!group) return fail("That group was not found.");
  group.name = name;
  group.approvalMode = input.approvalMode as Group["approvalMode"];
  return { ok: true, value: next };
}

export type UserDraft = {
  displayName: string;
  role: string;
  groupId: string;
};

export function validateUserDraft(store: StoreData, draft: UserDraft, exceptId?: string): string | null {
  const displayName = draft.displayName.trim();
  if (!displayName) return "Enter a name.";
  if (!ROLES.has(draft.role as Role)) return "Choose a role.";
  if (!store.groups.some((group) => group.id === draft.groupId)) return "Choose a group.";
  if (draft.role !== "admin") {
    const remainingAdmins = store.users.filter((user) => user.role === "admin" && user.id !== exceptId);
    const current = exceptId ? store.users.find((user) => user.id === exceptId) : undefined;
    if (current?.role === "admin" && remainingAdmins.length === 0) {
      return "There must be at least one administrator.";
    }
  }
  return null;
}

export function createUser(store: StoreData, actor: User, draft: UserDraft): Result<{ store: StoreData; user: User }> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const error = validateUserDraft(store, draft);
  if (error) return fail(error);
  const user: User = {
    id: crypto.randomUUID(),
    displayName: draft.displayName.trim(),
    role: draft.role as Role,
    groupId: draft.groupId,
  };
  const next = structuredClone(store);
  next.users.push(user);
  return { ok: true, value: { store: next, user } };
}

export function updateUser(store: StoreData, actor: User, userId: string, draft: UserDraft): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  if (!store.users.some((user) => user.id === userId)) return fail("That person was not found.");
  const error = validateUserDraft(store, draft, userId);
  if (error) return fail(error);
  const next = structuredClone(store);
  const user = next.users.find((entry) => entry.id === userId);
  if (!user) return fail("That person was not found.");
  user.displayName = draft.displayName.trim();
  user.role = draft.role as Role;
  user.groupId = draft.groupId;
  return { ok: true, value: next };
}

export function updateSettings(store: StoreData, actor: User, siteName: string): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const name = siteName.trim();
  if (!name) return fail("Enter a site name.");
  if (name.length > 60) return fail("Site name must be 60 characters or fewer.");
  const next = structuredClone(store);
  next.settings = { siteName: name } satisfies Settings;
  return { ok: true, value: next };
}

export function itemLabel(store: StoreData, itemId: string): string {
  return (
    store.items.find((item) => item.id === itemId)?.name ??
    [...store.ledger].reverse().find((entry) => entry.itemId === itemId)?.itemName ??
    "Removed supply"
  );
}

export function personName(store: StoreData, userId: string): string {
  return store.users.find((user) => user.id === userId)?.displayName ?? "Unknown person";
}

export function groupName(store: StoreData, groupId: string): string {
  return store.groups.find((group) => group.id === groupId)?.name ?? "Unknown group";
}
