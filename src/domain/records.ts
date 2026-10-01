import { fail, type ApprovalMode, type Group, type Result, type Role, type Settings, type StoreData, type User } from "./types";
import { addCodeError, grantCeilingError, isAdmin, manageCodeError, permissionError } from "./permissions";

const APPROVAL_MODES = new Set(["automatic", "required"]);

export type GroupDraft = {
  name: string;
};

function roleForGroup(group: Group | undefined): Role {
  return group?.grantsAdmin ? "admin" : "member";
}

function groupNameTaken(store: StoreData, name: string, exceptId?: string): boolean {
  return store.groups.some((group) => group.id !== exceptId && group.name.toLowerCase() === name.toLowerCase());
}

function readGroupDraft(input: GroupDraft): { name: string } | string {
  const name = input.name.trim();
  if (!name) return "Enter a group name.";
  return { name };
}

/**
 * Older stores have no Administrators group and keep only code hashes.
 * Create that group when it is missing, move existing administrators into it,
 * and fill in the new group fields. Codes that are only hashes stay that way.
 */
export function ensureAccessModel(store: StoreData): { store: StoreData; changed: boolean } {
  const next = structuredClone(store);
  let changed = false;

  for (const group of next.groups) {
    const legacy = group as Group & { approvalMode?: unknown; membersCanReturn?: unknown };
    if ("approvalMode" in legacy) {
      delete legacy.approvalMode;
      changed = true;
    }
    if ("membersCanReturn" in legacy) {
      delete legacy.membersCanReturn;
      changed = true;
    }
    if (typeof group.grantsAdmin !== "boolean") {
      group.grantsAdmin = false;
      changed = true;
    }
  }

  let adminGroup = next.groups.find((group) => group.grantsAdmin);
  if (!adminGroup) {
    adminGroup = {
      id: crypto.randomUUID(),
      name: "Administrators",
      grantsAdmin: true,
    };
    next.groups.unshift(adminGroup);
    changed = true;
  }

  for (const user of next.users) {
    if (user.role === "admin" && user.groupId !== adminGroup.id) {
      user.groupId = adminGroup.id;
      changed = true;
    }
  }

  for (const user of next.users) {
    const role = roleForGroup(next.groups.find((group) => group.id === user.groupId));
    if (user.role !== role) {
      user.role = role;
      changed = true;
    }
    if (user.approvalMode !== "automatic" && user.approvalMode !== "required") {
      user.approvalMode = "required";
      changed = true;
    }
    if (typeof user.canReturn !== "boolean") {
      user.canReturn = false;
      changed = true;
    }
    if (typeof user.groupAdmin !== "boolean") {
      user.groupAdmin = false;
      changed = true;
    }
  }

  let primary = next.users.find((user) => user.primaryAdmin && user.role === "admin");
  if (!primary) {
    primary = next.users.find((user) => user.role === "admin");
    if (primary && !primary.primaryAdmin) {
      primary.primaryAdmin = true;
      changed = true;
    }
  }
  for (const user of next.users) {
    const should = user.id === primary?.id;
    if (user.primaryAdmin !== should) {
      user.primaryAdmin = should;
      changed = true;
    }
  }

  if (!changed) return { store, changed: false };
  return { store: next, changed: true };
}

export function createGroup(store: StoreData, actor: User, input: GroupDraft): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const draft = readGroupDraft(input);
  if (typeof draft === "string") return fail(draft);
  if (groupNameTaken(store, draft.name)) return fail("A group with that name already exists.");
  const next = structuredClone(store);
  next.groups.push({
    id: crypto.randomUUID(),
    name: draft.name,
    grantsAdmin: false,
  });
  return { ok: true, value: next };
}

export function updateGroup(store: StoreData, actor: User, groupId: string, input: GroupDraft): Result<StoreData> {
  const denied = permissionError(actor);
  if (denied) return fail(denied);
  const existing = store.groups.find((group) => group.id === groupId);
  if (!existing) return fail("That group was not found.");
  const draft = readGroupDraft(input);
  if (typeof draft === "string") return fail(draft);
  if (groupNameTaken(store, draft.name, groupId)) return fail("A group with that name already exists.");
  const next = structuredClone(store);
  const group = next.groups.find((entry) => entry.id === groupId);
  if (!group) return fail("That group was not found.");
  group.name = draft.name;
  return { ok: true, value: next };
}

export function addAccessCode(
  store: StoreData,
  actor: User,
  groupId: string,
  displayName: string,
  code: string,
  codeHash: string,
): Result<{ store: StoreData; user: User }> {
  const denied = addCodeError(store, actor, groupId);
  if (denied) return fail(denied);
  const name = displayName.trim();
  if (!name) return fail("Enter a name.");
  const group = store.groups.find((entry) => entry.id === groupId);
  if (!group) return fail("That group was not found.");
  const user: User = {
    id: crypto.randomUUID(),
    displayName: name,
    role: roleForGroup(group),
    groupId,
    approvalMode: "required",
    canReturn: false,
    groupAdmin: false,
    primaryAdmin: false,
  };
  const next = structuredClone(store);
  next.users.push(user);
  next.credentials.push({ userId: user.id, codeHash, code });
  return { ok: true, value: { store: next, user } };
}

export function renameAccessCode(store: StoreData, actor: User, userId: string, displayName: string): Result<StoreData> {
  const denied = manageCodeError(store, actor, userId, "rename");
  if (denied) return fail(denied);
  const name = displayName.trim();
  if (!name) return fail("Enter a name.");
  const credential = store.credentials.find((entry) => entry.userId === userId);
  if (!credential) return fail("That access code was not found.");
  const next = structuredClone(store);
  const user = next.users.find((entry) => entry.id === userId);
  if (!user) return fail("That person was not found.");
  user.displayName = name;
  return { ok: true, value: next };
}

export function replaceAccessCode(
  store: StoreData,
  actor: User,
  userId: string,
  code: string,
  codeHash: string,
): Result<StoreData> {
  const denied = manageCodeError(store, actor, userId, "rotate");
  if (denied) return fail(denied);
  const next = structuredClone(store);
  const credential = next.credentials.find((entry) => entry.userId === userId);
  if (!credential) return fail("That access code was not found.");
  credential.code = code;
  credential.codeHash = codeHash;
  return { ok: true, value: next };
}

export function removeAccessCode(store: StoreData, actor: User, userId: string): Result<StoreData> {
  const denied = manageCodeError(store, actor, userId, "remove");
  if (denied) return fail(denied);
  const person = store.users.find((user) => user.id === userId);
  if (!person) return fail("That person was not found.");
  const credential = store.credentials.find((entry) => entry.userId === userId);
  if (!credential) return fail("That access code was not found.");
  const group = store.groups.find((entry) => entry.id === person.groupId);
  if (group?.grantsAdmin) {
    const remaining = store.credentials.filter((entry) => {
      if (entry.userId === userId) return false;
      const owner = store.users.find((user) => user.id === entry.userId);
      return owner?.groupId === group.id;
    });
    if (remaining.length === 0) {
      return fail(`The last code in ${group.name} cannot be removed.`);
    }
  }
  const next = structuredClone(store);
  next.credentials = next.credentials.filter((entry) => entry.userId !== userId);
  return { ok: true, value: next };
}

export type PersonPermissionDraft = {
  approvalMode: string;
  canReturn: boolean;
  groupAdmin: boolean;
};

export function updateUserPermissions(
  store: StoreData,
  actor: User,
  userId: string,
  input: PersonPermissionDraft,
): Result<StoreData> {
  if (!isAdmin(actor) && !actor.groupAdmin) return fail("You do not have permission to do that.");
  if (!isAdmin(actor) && actor.id === userId) return fail("You cannot change your own settings.");
  const target = store.users.find((user) => user.id === userId);
  if (!target) return fail("That person was not found.");
  if (!store.credentials.some((credential) => credential.userId === userId)) {
    return fail("That access code was not found.");
  }
  if (!isAdmin(actor) && target.groupId !== actor.groupId) {
    return fail("You can only change people in your group.");
  }
  const group = store.groups.find((entry) => entry.id === target.groupId);
  if (!group) return fail("That group was not found.");
  if (!isAdmin(actor) && group.grantsAdmin) return fail("You cannot change the Administrators group.");
  if (!APPROVAL_MODES.has(input.approvalMode)) return fail("Choose an approval mode.");

  const draft = {
    approvalMode: input.approvalMode as ApprovalMode,
    canReturn: input.canReturn,
    groupAdmin: group.grantsAdmin ? false : input.groupAdmin,
  };
  const ceiling = grantCeilingError(actor, target, draft);
  if (ceiling) return fail(ceiling);

  const next = structuredClone(store);
  const person = next.users.find((user) => user.id === userId);
  if (!person) return fail("That person was not found.");
  person.approvalMode = draft.approvalMode;
  person.canReturn = draft.canReturn;
  person.groupAdmin = draft.groupAdmin;
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
