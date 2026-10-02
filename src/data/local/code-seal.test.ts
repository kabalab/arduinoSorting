import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import type { StoreData } from "@/src/domain/types";
import {
  decryptAccessCode,
  encryptAccessCode,
  loadCodeKey,
  openCredentials,
  sealCredentials,
} from "./code-seal";

function store(code?: string): StoreData {
  return {
    settings: { siteName: "Equipment storage" },
    groups: [],
    users: [],
    credentials: [{ userId: "user-admin", codeHash: "hash", ...(code ? { code } : {}) }],
    items: [],
    ledger: [],
    requests: [],
  };
}

describe("access code sealing", () => {
  it("decrypts back to the same code and hides it from the sealed copy", () => {
    const key = randomBytes(32);
    const sealed = sealCredentials(store("J3XYPNKN"), key);
    const saved = sealed.credentials[0]?.code ?? "";
    assert.equal(saved.includes("J3XYPNKN"), false);
    assert.equal(decryptAccessCode(saved, key), "J3XYPNKN");
    assert.equal(store("J3XYPNKN").credentials[0]?.code, "J3XYPNKN");

    const opened = openCredentials(sealed, key);
    assert.equal(opened.reseal, false);
    assert.equal(opened.store.credentials[0]?.code, "J3XYPNKN");
  });

  it("marks a plaintext code so the file can be rewritten", () => {
    const key = randomBytes(32);
    const opened = openCredentials(store("J3XYPNKN"), key);
    assert.equal(opened.reseal, true);
    assert.equal(opened.store.credentials[0]?.code, "J3XYPNKN");
  });

  it("drops one damaged code and refuses a key that opens nothing", () => {
    const key = randomBytes(32);
    const other = randomBytes(32);
    const saved = encryptAccessCode("J3XYPNKN", key);
    const damaged = store(saved);
    damaged.credentials.push({ userId: "user-arduino", codeHash: "hash-2", code: `${saved}x` });

    const opened = openCredentials(damaged, key);
    assert.equal(opened.store.credentials[0]?.code, "J3XYPNKN");
    assert.equal(opened.store.credentials[1]?.code, undefined);

    assert.throws(() => openCredentials(store(saved), other), /does not match/);
  });

  it("creates a key file once and reads the same key again", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "code-key-"));
    const filePath = path.join(directory, "code-key");
    try {
      const created = await loadCodeKey(filePath, true);
      const loaded = await loadCodeKey(filePath, false);
      assert.equal(created.equals(loaded), true);
      assert.equal(created.length, 32);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
