import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestItems } from "./names";
import { displayStatus, isOverdue, overdueLabel } from "./overdue";
import { canRequestItem, manageCodeError, memberCanSeeCheckout } from "./permissions";
import { addAccessCode, ensureAccessModel, removeAccessCode, renameAccessCode, replaceAccessCode, updateUserPermissions } from "./records";
import { adminCheckout, approveRequest, returnItems, submitRequest } from "./requests";
import { adjustAvailable, createItem, removeItem } from "./stock";
import { itemTotal, type Group, type StoreData, type User } from "./types";

const now = new Date(2026, 8, 30, 12, 0, 0);

function store(): StoreData {
  return {
    users: [
      { id: "admin", displayName: "Ada", role: "admin", groupId: "arduino", approvalMode: "required", canReturn: false, groupAdmin: false },
      { id: "alex", displayName: "Alex", role: "member", groupId: "arduino", approvalMode: "automatic", canReturn: false, groupAdmin: false },
      { id: "jordan", displayName: "Jordan", role: "member", groupId: "robotics", approvalMode: "required", canReturn: false, groupAdmin: false },
    ],
    credentials: [],
    groups: [
      { id: "arduino", name: "Arduino", grantsAdmin: false },
      { id: "robotics", name: "Robotics", grantsAdmin: false },
    ],
    items: [
      {
        id: "uno",
        name: "Arduino Uno",
        description: "",
        category: "Boards",
        imageUrl: "",
        requestBlacklist: [],
        available: 4,
        checkedOut: 0,
      },
      {
        id: "mega",
        name: "Arduino Mega",
        description: "",
        category: "Boards",
        imageUrl: "",
        requestBlacklist: [],
        available: 2,
        checkedOut: 0,
      },
      {
        id: "nano",
        name: "Arduino Nano",
        description: "",
        category: "Boards",
        imageUrl: "",
        requestBlacklist: [],
        available: 1,
        checkedOut: 0,
      },
      {
        id: "uno-r3",
        name: "Arduino Uno R3",
        description: "",
        category: "Boards",
        imageUrl: "",
        requestBlacklist: [],
        available: 1,
        checkedOut: 0,
      },
      {
        id: "servo",
        name: "Servo",
        description: "",
        category: "Motors",
        imageUrl: "",
        requestBlacklist: ["robotics"],
        available: 3,
        checkedOut: 1,
      },
    ],
    ledger: [],
    requests: [],
    settings: { siteName: "Equipment storage" },
  };
}

const admin: User = { id: "admin", displayName: "Ada", role: "admin", groupId: "arduino", approvalMode: "required", canReturn: false, groupAdmin: false };
const alex: User = { id: "alex", displayName: "Alex", role: "member", groupId: "arduino", approvalMode: "automatic", canReturn: false, groupAdmin: false };
const jordan: User = { id: "jordan", displayName: "Jordan", role: "member", groupId: "robotics", approvalMode: "required", canReturn: false, groupAdmin: false };

describe("names", () => {
  it("matches case-insensitive substrings", () => {
    const items = store().items;
    assert.deepEqual(
      suggestItems("uno", items).map((item) => item.name),
      ["Arduino Uno", "Arduino Uno R3"],
    );
    assert.deepEqual(
      suggestItems("Arduino", items).map((item) => item.name),
      ["Arduino Uno", "Arduino Mega", "Arduino Nano", "Arduino Uno R3"],
    );
  });
});

describe("stock", () => {
  it("refuses quantities that exceed availability or go negative", () => {
    const submitted = submitRequest(
      store(),
      alex,
      { lines: [{ itemId: "uno", quantity: 5 }], expectedReturn: "2026-10-02" },
      now,
    );
    assert.equal(submitted.ok, false);
    if (!submitted.ok) assert.match(submitted.error, /available/i);

    const adjusted = adjustAvailable(store(), admin, "uno", -5, now);
    assert.equal(adjusted.ok, false);
  });

  it("blocks removal while any quantity is checked out", () => {
    const removed = removeItem(store(), admin, "servo", now);
    assert.equal(removed.ok, false);
    if (!removed.ok) assert.match(removed.error, /checked out/i);
  });

  it("keeps total equal to available plus checked out", () => {
    const created = createItem(
      store(),
      admin,
      {
        name: "Jumper wires",
        description: "",
        category: "Cables",
        imageUrl: "",
        requestBlacklist: [],
        available: 10,
      },
      now,
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const item = created.value.items.find((entry) => entry.name === "Jumper wires");
    assert.ok(item);
    assert.equal(itemTotal(item), 10);
    assert.equal(created.value.ledger.at(-1)?.kind, "added");
  });
});

describe("requests", () => {
  it("checks out immediately when that person is set to automatic", () => {
    const result = submitRequest(
      store(),
      alex,
      { lines: [{ itemId: "uno", quantity: 2 }], expectedReturn: "2026-10-02" },
      now,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const request = result.value.requests[0];
    const item = result.value.items.find((entry) => entry.id === "uno");
    assert.equal(request.status, "checked_out");
    assert.ok(request.approvedAt);
    assert.equal(item?.available, 2);
    assert.equal(item?.checkedOut, 2);
    assert.equal(displayStatus(request, now), "checked_out");
  });

  it("leaves a person who requires approval pending until approval, then checks out", () => {
    const pending = submitRequest(
      store(),
      jordan,
      { lines: [{ itemId: "mega", quantity: 1 }], expectedReturn: "2026-10-06" },
      now,
    );
    assert.equal(pending.ok, true);
    if (!pending.ok) return;
    assert.equal(pending.value.requests[0].status, "pending");
    assert.equal(pending.value.items.find((item) => item.id === "mega")?.available, 2);

    const approved = approveRequest(pending.value, admin, pending.value.requests[0].id, now);
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    const request = approved.value.requests[0];
    assert.equal(request.status, "checked_out");
    assert.ok(request.approvedAt);
    assert.equal(approved.value.items.find((item) => item.id === "mega")?.available, 1);
    assert.equal(approved.value.items.find((item) => item.id === "mega")?.checkedOut, 1);
  });

  it("rejects a blacklisted group even when the item id is submitted directly", () => {
    assert.equal(canRequestItem(store().items.find((item) => item.id === "servo")!, "robotics"), false);
    const result = submitRequest(
      store(),
      jordan,
      { lines: [{ itemId: "servo", quantity: 1 }], expectedReturn: "2026-10-02" },
      now,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /cannot request/i);
  });

  it("returns part of a checkout and closes it only when every line is back", () => {
    const submitted = submitRequest(
      store(),
      alex,
      {
        lines: [
          { itemId: "uno", quantity: 2 },
          { itemId: "mega", quantity: 1 },
        ],
        expectedReturn: "2026-10-02",
      },
      now,
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const requestId = submitted.value.requests[0].id;
    const partial = returnItems(submitted.value, admin, requestId, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(partial.ok, true);
    if (!partial.ok) return;
    assert.equal(partial.value.requests[0].status, "checked_out");
    assert.equal(partial.value.items.find((item) => item.id === "uno")?.available, 3);
    assert.equal(partial.value.items.find((item) => item.id === "uno")?.checkedOut, 1);

    const full = returnItems(
      partial.value,
      admin,
      requestId,
      [
        { itemId: "uno", quantity: 1 },
        { itemId: "mega", quantity: 1 },
      ],
      now,
    );
    assert.equal(full.ok, true);
    if (!full.ok) return;
    assert.equal(full.value.requests[0].status, "returned");
    assert.equal(full.value.items.find((item) => item.id === "uno")?.available, 4);
    assert.equal(full.value.items.find((item) => item.id === "mega")?.available, 2);
    assert.equal(full.value.items.find((item) => item.id === "uno")?.checkedOut, 0);
  });
});

describe("access model", () => {
  it("creates Administrators and moves existing administrators into it", () => {
    const legacy = store();
    legacy.groups = [{ id: "arduino", name: "Arduino" } as Group];
    legacy.users[0].groupId = "arduino";
    legacy.users[0].role = "admin";

    const first = ensureAccessModel(legacy);
    assert.equal(first.changed, true);
    const admins = first.store.groups.find((group) => group.grantsAdmin);
    assert.ok(admins);
    assert.equal(admins.name, "Administrators");
    assert.equal(first.store.users.find((user) => user.id === "admin")?.groupId, admins.id);
    assert.equal(first.store.users.find((user) => user.id === "admin")?.role, "admin");
    assert.equal(first.store.users.find((user) => user.id === "alex")?.role, "member");
    assert.equal(first.store.users.find((user) => user.id === "admin")?.primaryAdmin, true);
    assert.equal(first.store.users.find((user) => user.id === "alex")?.primaryAdmin, false);

    const second = ensureAccessModel(first.store);
    assert.equal(second.changed, false);
    assert.equal(second.store.groups.filter((group) => group.grantsAdmin).length, 1);
  });

  it("refuses to remove the last code in the administrators group", () => {
    const data = store();
    data.groups.unshift({
      id: "admins",
      name: "Administrators",
      grantsAdmin: true,
    });
    data.users[0].groupId = "admins";
    data.credentials.push({ userId: "admin", codeHash: "hash", code: "CODE1234" });
    data.credentials.push({ userId: "alex", codeHash: "hash-2", code: "CODE5678" });

    const blocked = removeAccessCode(data, admin, "admin");
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /cannot be removed/i);

    data.users.push({
      id: "sam",
      displayName: "Sam",
      role: "admin",
      groupId: "admins",
      approvalMode: "required",
      canReturn: false,
      groupAdmin: false,
    });
    data.credentials.push({ userId: "sam", codeHash: "hash-3", code: "CODE9999" });
    const removed = removeAccessCode(data, admin, "sam");
    assert.equal(removed.ok, true);
    if (!removed.ok) return;
    assert.equal(removed.value.credentials.some((credential) => credential.userId === "sam"), false);
    assert.equal(removed.value.users.some((user) => user.id === "sam"), true);
  });
});

describe("admin checkout and member returns", () => {
  it("checks out immediately for any group, including hidden items, when stock allows", () => {
    const hidden = adminCheckout(
      store(),
      admin,
      { groupId: "robotics", lines: [{ itemId: "servo", quantity: 1 }], expectedReturn: "2026-10-02" },
      now,
    );
    assert.equal(hidden.ok, true);
    if (!hidden.ok) return;
    const request = hidden.value.requests[0];
    assert.equal(request.status, "checked_out");
    assert.equal(request.groupId, "robotics");
    assert.equal(request.requesterId, "admin");
    assert.equal(hidden.value.items.find((item) => item.id === "servo")?.available, 2);
    assert.equal(hidden.value.items.find((item) => item.id === "servo")?.checkedOut, 2);

    const short = adminCheckout(
      store(),
      admin,
      { groupId: "robotics", lines: [{ itemId: "servo", quantity: 99 }], expectedReturn: "2026-10-02" },
      now,
    );
    assert.equal(short.ok, false);
    if (!short.ok) assert.match(short.error, /available/i);
  });

  it("lets a person return their own loan only when they can mark items returned", () => {
    const submitted = submitRequest(
      store(),
      alex,
      { lines: [{ itemId: "uno", quantity: 1 }], expectedReturn: "2026-10-02" },
      now,
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const requestId = submitted.value.requests[0].id;
    const blocked = returnItems(submitted.value, alex, requestId, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(blocked.ok, false);

    const allowedStore = submitted.value;
    const stillBlocked = returnItems(allowedStore, alex, requestId, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(stillBlocked.ok, false);
    const other: User = {
      id: "sam",
      displayName: "Sam",
      role: "member",
      groupId: "arduino",
      approvalMode: "automatic",
      canReturn: true,
      groupAdmin: false,
    };
    allowedStore.users.push(other);
    const otherReturn = returnItems(allowedStore, other, requestId, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(otherReturn.ok, false);

    const ownReturn = returnItems(allowedStore, { ...alex, canReturn: true }, requestId, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(ownReturn.ok, true);
  });

  it("shows an admin checkout to that group and lets a person return it when they can mark items returned", () => {
    const data = store();
    const issued = adminCheckout(
      data,
      admin,
      { groupId: "arduino", lines: [{ itemId: "uno", quantity: 1 }], expectedReturn: "2026-10-02" },
      now,
    );
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    const request = issued.value.requests[0];
    assert.equal(memberCanSeeCheckout(issued.value, alex, request), true);
    assert.equal(memberCanSeeCheckout(issued.value, jordan, request), false);

    const blocked = returnItems(issued.value, alex, request.id, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(blocked.ok, false);

    const returned = returnItems(issued.value, { ...alex, canReturn: true }, request.id, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(returned.ok, true);
    if (!returned.ok) return;
    assert.equal(returned.value.requests[0].status, "returned");
  });
});

describe("per-user permissions", () => {
  it("fills in missing person settings with approval required", () => {
    const data = store();
    const person = data.users.find((user) => user.id === "alex");
    assert.ok(person);
    delete (person as Partial<User>).approvalMode;
    delete (person as Partial<User>).canReturn;
    delete (person as Partial<User>).groupAdmin;

    const first = ensureAccessModel(data);
    assert.equal(first.changed, true);
    const copied = first.store.users.find((user) => user.id === "alex");
    assert.equal(copied?.approvalMode, "required");
    assert.equal(copied?.canReturn, false);
    assert.equal(copied?.groupAdmin, false);
    assert.equal(ensureAccessModel(first.store).changed, false);
  });

  it("uses the person's approval mode when it differs from the group", () => {
    const pending = submitRequest(
      store(),
      { ...alex, approvalMode: "required" },
      { lines: [{ itemId: "uno", quantity: 1 }], expectedReturn: "2026-10-02" },
      now,
    );
    assert.equal(pending.ok, true);
    if (!pending.ok) return;
    assert.equal(pending.value.requests[0].status, "pending");
  });

  it("lets a group admin approve only their own group's pending requests", () => {
    const pending = submitRequest(
      store(),
      jordan,
      { lines: [{ itemId: "mega", quantity: 1 }], expectedReturn: "2026-10-06" },
      now,
    );
    assert.equal(pending.ok, true);
    if (!pending.ok) return;
    const requestId = pending.value.requests[0].id;

    const outsider = approveRequest(pending.value, { ...alex, groupAdmin: true }, requestId, now);
    assert.equal(outsider.ok, false);

    const approved = approveRequest(pending.value, { ...jordan, groupAdmin: true }, requestId, now);
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    assert.equal(approved.value.requests[0].status, "checked_out");
  });

  it("stops a group admin from giving permissions they do not have", () => {
    const data = store();
    data.credentials.push({ userId: "alex", codeHash: "hash-alex" });
    data.credentials.push({ userId: "jordan", codeHash: "hash-jordan" });
    data.users.push({
      id: "sam",
      displayName: "Sam",
      role: "member",
      groupId: "arduino",
      approvalMode: "required",
      canReturn: false,
      groupAdmin: false,
    });
    data.credentials.push({ userId: "sam", codeHash: "hash-sam" });
    const lead: User = { ...alex, groupAdmin: true, approvalMode: "required", canReturn: false };

    const raised = updateUserPermissions(data, lead, "sam", {
      approvalMode: "automatic",
      canReturn: true,
      groupAdmin: false,
    });
    assert.equal(raised.ok, false);
    if (!raised.ok) assert.match(raised.error, /permissions you have/i);

    const kept = updateUserPermissions(
      {
        ...data,
        users: data.users.map((user) => (user.id === "sam" ? { ...user, approvalMode: "automatic" } : user)),
      },
      lead,
      "sam",
      { approvalMode: "automatic", canReturn: false, groupAdmin: false },
    );
    assert.equal(kept.ok, true);
    if (!kept.ok) return;
    assert.equal(kept.value.users.find((user) => user.id === "sam")?.approvalMode, "automatic");

    const granted = updateUserPermissions(data, { ...lead, approvalMode: "automatic", canReturn: true }, "sam", {
      approvalMode: "automatic",
      canReturn: true,
      groupAdmin: true,
    });
    assert.equal(granted.ok, true);
    if (!granted.ok) return;
    const sam = granted.value.users.find((user) => user.id === "sam");
    assert.equal(sam?.approvalMode, "automatic");
    assert.equal(sam?.canReturn, true);
    assert.equal(sam?.groupAdmin, true);

    const self = updateUserPermissions(data, { ...lead, approvalMode: "automatic", canReturn: true }, "alex", {
      approvalMode: "automatic",
      canReturn: true,
      groupAdmin: true,
    });
    assert.equal(self.ok, false);

    const otherGroup = updateUserPermissions(data, { ...lead, approvalMode: "automatic", canReturn: true }, "jordan", {
      approvalMode: "required",
      canReturn: false,
      groupAdmin: false,
    });
    assert.equal(otherGroup.ok, false);

    const byAdmin = updateUserPermissions(data, admin, "sam", {
      approvalMode: "automatic",
      canReturn: true,
      groupAdmin: true,
    });
    assert.equal(byAdmin.ok, true);
  });
});

describe("code management", () => {
  it("lets a group admin add people and change codes in their group, including their own", () => {
    const data = store();
    data.credentials.push({ userId: "alex", codeHash: "hash-alex", code: "ALEXCODE" });
    data.credentials.push({ userId: "jordan", codeHash: "hash-jordan", code: "JORDAN" });
    const lead: User = { ...alex, groupAdmin: true };

    const renamed = renameAccessCode(data, lead, "alex", "Alexis");
    assert.equal(renamed.ok, true);
    const rotated = replaceAccessCode(data, lead, "alex", "NEWCODE", "hash-new");
    assert.equal(rotated.ok, true);
    const added = addAccessCode(data, lead, "arduino", "Sam", "SAMCODE", "hash-sam");
    assert.equal(added.ok, true);

    const otherGroup = renameAccessCode(data, lead, "jordan", "Nope");
    assert.equal(otherGroup.ok, false);
    const removed = removeAccessCode(data, lead, "alex");
    assert.equal(removed.ok, false);
    const elsewhere = addAccessCode(data, lead, "robotics", "Sam", "NOPE", "hash-nope");
    assert.equal(elsewhere.ok, false);
  });

  it("stops a later administrator from viewing or changing the original administrator code or their own code", () => {
    const data = store();
    data.groups.unshift({ id: "admins", name: "Administrators", grantsAdmin: true });
    data.users[0].groupId = "admins";
    data.users[0].role = "admin";
    data.users[0].primaryAdmin = true;
    const extra: User = {
      id: "extra",
      displayName: "Extra",
      role: "admin",
      groupId: "admins",
      approvalMode: "required",
      canReturn: false,
      groupAdmin: false,
      primaryAdmin: false,
    };
    data.users.push(extra);
    data.credentials.push({ userId: "admin", codeHash: "hash-admin", code: "ORIG" });
    data.credentials.push({ userId: "extra", codeHash: "hash-extra", code: "EXTRA" });
    data.credentials.push({ userId: "jordan", codeHash: "hash-jordan", code: "JORDAN" });
    const original = data.users[0];

    assert.match(manageCodeError(data, extra, "admin", "reveal") ?? "", /original administrator/i);
    assert.match(manageCodeError(data, extra, "admin", "rotate") ?? "", /original administrator/i);
    assert.match(manageCodeError(data, extra, "extra", "rotate") ?? "", /own access code/i);
    assert.equal(manageCodeError(data, extra, "extra", "reveal"), null);
    assert.equal(manageCodeError(data, extra, "admin", "rename"), null);
    assert.equal(manageCodeError(data, extra, "jordan", "rotate"), null);
    assert.equal(manageCodeError(data, extra, "jordan", "remove"), null);
    assert.equal(manageCodeError(data, original, "extra", "rotate"), null);
    assert.equal(manageCodeError(data, original, "admin", "reveal"), null);
    assert.equal(removeAccessCode(data, extra, "admin").ok, false);
  });
});

describe("overdue", () => {
  it("calculates overdue without rewriting the stored status", () => {
    const data = store();
    data.requests.push({
      id: "loan",
      groupId: "arduino",
      requesterId: "alex",
      createdAt: "2026-09-20T12:00:00.000Z",
      expectedReturn: "2026-09-28",
      status: "checked_out",
      approvedAt: "2026-09-20T12:00:00.000Z",
      approvedBy: "alex",
      checkedOutAt: "2026-09-20T12:00:00.000Z",
      lines: [{ itemId: "uno", quantityRequested: 1, quantityCheckedOut: 1, quantityReturned: 0 }],
    });
    const request = data.requests[0];
    assert.equal(isOverdue(request, now), true);
    assert.equal(request.status, "checked_out");
    assert.equal(displayStatus(request, now), "overdue");
    assert.equal(overdueLabel(request, now), "2 days overdue");
  });
});
