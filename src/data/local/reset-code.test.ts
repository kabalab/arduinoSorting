import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { hashAccessCode, verifyAccessCode } from "@/src/auth/codes";
import type { StoreData, User } from "@/src/domain/types";
import {
  applyDefaultCodes,
  defaultsFromInitialCodes,
  ensureResetFile,
  isResetCode,
  parseResetFile,
  sameSecret,
} from "./reset-code";

function person(id: string, displayName: string): User {
  return {
    id,
    displayName,
    role: id === "user-admin" ? "admin" : "member",
    groupId: id,
    approvalMode: "required",
    canReturn: false,
    groupAdmin: false,
  };
}

function store(): StoreData {
  return {
    settings: { siteName: "Equipment storage" },
    groups: [],
    users: [person("user-admin", "Admin"), person("user-arduino", "Alex Chen"), person("user-robotics", "Jordan Lee")],
    credentials: [
      { userId: "user-admin", codeHash: "old-admin", code: "ROTATED1" },
      { userId: "user-arduino", codeHash: "old-arduino" },
      { userId: "user-extra", codeHash: "keep", code: "EXTRA123" },
    ],
    items: [],
    ledger: [],
    requests: [],
  };
}

describe("reset code", () => {
  it("reads the reset code and the original access codes", () => {
    const parsed = parseResetFile(`
# note
reset ABCD2345
user-admin J3XYPNKN
user-arduino XTS7XS8Y
not-a-code
`);
    assert.deepEqual(parsed, {
      resetCode: "ABCD2345",
      defaults: [
        { userId: "user-admin", code: "J3XYPNKN" },
        { userId: "user-arduino", code: "XTS7XS8Y" },
      ],
    });
  });

  it("maps the original code file onto people even after a rename", () => {
    const defaults = defaultsFromInitialCodes(
      ["Admin — Ada Okonkwo — J3XYPNKN", "Arduino — Alex Chen — XTS7XS8Y", "Robotics — Jordan Lee — 9SKBXH56"].join("\n"),
      store().users,
    );
    assert.deepEqual(defaults, [
      { userId: "user-admin", code: "J3XYPNKN" },
      { userId: "user-arduino", code: "XTS7XS8Y" },
      { userId: "user-robotics", code: "9SKBXH56" },
    ]);
  });

  it("puts the original codes back and leaves everyone else alone", async () => {
    const current = store();
    const codeHash = await hashAccessCode("J3XYPNKN");
    const applied = applyDefaultCodes(current, [{ userId: "user-admin", code: "J3XYPNKN", codeHash }]);
    assert.equal(current.credentials[0]?.code, "ROTATED1");
    assert.equal(applied.restored, 1);
    assert.equal(applied.store.credentials[0]?.code, "J3XYPNKN");
    assert.equal(await verifyAccessCode("J3XYPNKN", applied.store.credentials[0]?.codeHash ?? ""), true);
    assert.equal(applied.store.credentials[2]?.code, "EXTRA123");
  });

  it("compares secrets without treating different lengths as equal", () => {
    assert.equal(sameSecret("ABCD2345", "ABCD2345"), true);
    assert.equal(sameSecret("ABCD2345", "ABCD2346"), false);
    assert.equal(sameSecret("ABCD2345", "ABC"), false);
  });

  it("writes the reset file once and does not replace it", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "reset-code-"));
    const filePath = path.join(dir, "reset-code.txt");
    try {
      await ensureResetFile(store().users, { defaults: [{ userId: "user-admin", code: "J3XYPNKN" }] }, filePath);
      const first = await readFile(filePath, "utf8");
      await ensureResetFile(store().users, { defaults: [{ userId: "user-admin", code: "XTS7XS8Y" }] }, filePath);
      const second = await readFile(filePath, "utf8");
      assert.equal(second, first);
      assert.match(first, /user-admin J3XYPNKN/);
      assert.equal(await isResetCode(parseResetFile(first)?.resetCode ?? "", filePath), true);
      assert.equal(await isResetCode("J3XYPNKN", filePath), false);
    } finally {
      await chmod(filePath, 0o666).catch(() => undefined);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
