import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestItems } from "./names";
import { displayStatus, isOverdue, overdueLabel } from "./overdue";
import { canRequestItem, memberCanSeeCheckout } from "./permissions";
import { ensureAccessModel, removeAccessCode } from "./records";
import { adminCheckout, approveRequest, returnItems, submitRequest } from "./requests";
import { adjustAvailable, createItem, removeItem } from "./stock";
import { itemTotal, type Group, type StoreData, type User } from "./types";

const now = new Date(2026, 8, 30, 12, 0, 0);

function store(): StoreData {
  return {
    users: [
      { id: "admin", displayName: "Ada", role: "admin", groupId: "arduino" },
      { id: "alex", displayName: "Alex", role: "member", groupId: "arduino" },
      { id: "jordan", displayName: "Jordan", role: "member", groupId: "robotics" },
    ],
    credentials: [],
    groups: [
      { id: "arduino", name: "Arduino", approvalMode: "automatic", grantsAdmin: false, membersCanReturn: false },
      { id: "robotics", name: "Robotics", approvalMode: "required", grantsAdmin: false, membersCanReturn: false },
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

const admin: User = { id: "admin", displayName: "Ada", role: "admin", groupId: "arduino" };
const alex: User = { id: "alex", displayName: "Alex", role: "member", groupId: "arduino" };
const jordan: User = { id: "jordan", displayName: "Jordan", role: "member", groupId: "robotics" };

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
  it("checks out immediately for an automatic group", () => {
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

  it("leaves a required group pending until approval, then checks out", () => {
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
    legacy.groups = [{ id: "arduino", name: "Arduino", approvalMode: "automatic" } as Group];
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

    const second = ensureAccessModel(first.store);
    assert.equal(second.changed, false);
    assert.equal(second.store.groups.filter((group) => group.grantsAdmin).length, 1);
  });

  it("refuses to remove the last code in the administrators group", () => {
    const data = store();
    data.groups.unshift({
      id: "admins",
      name: "Administrators",
      approvalMode: "required",
      grantsAdmin: true,
      membersCanReturn: false,
    });
    data.users[0].groupId = "admins";
    data.credentials.push({ userId: "admin", codeHash: "hash", code: "CODE1234" });
    data.credentials.push({ userId: "alex", codeHash: "hash-2", code: "CODE5678" });

    const blocked = removeAccessCode(data, admin, "admin");
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /cannot be removed/i);

    data.users.push({ id: "sam", displayName: "Sam", role: "admin", groupId: "admins" });
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

  it("lets a member return their own loan and an admin checkout only when the group allows it", () => {
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
    allowedStore.groups[0].membersCanReturn = true;
    const other: User = { id: "sam", displayName: "Sam", role: "member", groupId: "arduino" };
    allowedStore.users.push(other);
    const otherReturn = returnItems(allowedStore, other, requestId, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(otherReturn.ok, false);

    const ownReturn = returnItems(allowedStore, alex, requestId, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(ownReturn.ok, true);
  });

  it("shows an admin checkout to that group and lets members return it when allowed", () => {
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

    issued.value.groups[0].membersCanReturn = true;
    const returned = returnItems(issued.value, alex, request.id, [{ itemId: "uno", quantity: 1 }], now);
    assert.equal(returned.ok, true);
    if (!returned.ok) return;
    assert.equal(returned.value.requests[0].status, "returned");
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
