import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestItems } from "./names";
import { displayStatus, isOverdue, overdueLabel } from "./overdue";
import { canRequestItem } from "./permissions";
import { approveRequest, returnItems, submitRequest } from "./requests";
import { adjustAvailable, createItem, removeItem } from "./stock";
import { itemTotal, type StoreData, type User } from "./types";

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
      { id: "arduino", name: "Arduino", approvalMode: "automatic" },
      { id: "robotics", name: "Robotics", approvalMode: "required" },
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
