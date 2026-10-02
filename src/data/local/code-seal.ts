import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreData } from "@/src/domain/types";

const PREFIX = "enc";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export const CODE_KEY_PATH = path.join(process.cwd(), "data", "code-key");

export function isSealedAccessCode(value: string): boolean {
  return value.startsWith(`${PREFIX}$`);
}

export function storeHasSealedCode(store: StoreData): boolean {
  return store.credentials.some((credential) => credential.code && isSealedAccessCode(credential.code));
}

export function encryptAccessCode(code: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join("$");
}

export function decryptAccessCode(payload: string, key: Buffer): string | null {
  const [prefix, ivPart, tagPart, cipherPart] = payload.split("$");
  if (prefix !== PREFIX || !ivPart || !tagPart || !cipherPart || payload.split("$").length !== 4) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(cipherPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Turns saved codes into plaintext for the running app.
 * A code that is still plaintext is left as-is and marked so the file can be rewritten.
 * One damaged value is dropped. If every sealed value fails, the key does not match and nothing is discarded.
 */
export function openCredentials(store: StoreData, key: Buffer): { store: StoreData; reseal: boolean } {
  const next = structuredClone(store);
  let reseal = false;
  let sealed = 0;
  let failed = 0;
  for (const credential of next.credentials) {
    if (!credential.code) continue;
    if (!isSealedAccessCode(credential.code)) {
      reseal = true;
      continue;
    }
    sealed += 1;
    const plain = decryptAccessCode(credential.code, key);
    if (plain === null) {
      failed += 1;
      delete credential.code;
      continue;
    }
    credential.code = plain;
  }
  if (sealed > 0 && failed === sealed) {
    throw new Error("Access codes could not be opened. data/code-key does not match this store.");
  }
  return { store: next, reseal };
}

/** Copies the store and encrypts plaintext codes. Already sealed values are left unchanged. */
export function sealCredentials(store: StoreData, key: Buffer): StoreData {
  const next = structuredClone(store);
  for (const credential of next.credentials) {
    if (!credential.code || isSealedAccessCode(credential.code)) continue;
    credential.code = encryptAccessCode(credential.code, key);
  }
  return next;
}

function decodeKey(raw: string): Buffer {
  const key = Buffer.from(raw.trim(), "base64url");
  if (key.length !== KEY_LENGTH) {
    throw new Error("data/code-key is not a valid encryption key.");
  }
  return key;
}

async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Reads the key that encrypts access codes on disk.
 * Creates it when `create` is true and the file is missing.
 * Does not create a replacement key when sealed codes already exist.
 */
export async function loadCodeKey(filePath = CODE_KEY_PATH, create = true): Promise<Buffer> {
  const existing = await readOptional(filePath);
  if (existing) return decodeKey(existing);
  if (!create) {
    throw new Error("data/code-key is missing, so encrypted access codes cannot be opened.");
  }
  const key = randomBytes(KEY_LENGTH);
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await writeFile(filePath, `${key.toString("base64url")}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const raced = await readOptional(filePath);
      if (raced) return decodeKey(raced);
    }
    throw error;
  }
  return key;
}
