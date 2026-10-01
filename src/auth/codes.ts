import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;

export async function hashAccessCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(code, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyAccessCode(code: string, codeHash: string): Promise<boolean> {
  const [algorithm, saltBase64, keyBase64] = codeHash.split("$");
  if (algorithm !== "scrypt" || !saltBase64 || !keyBase64) return false;
  const salt = Buffer.from(saltBase64, "base64");
  const expected = Buffer.from(keyBase64, "base64");
  const actual = (await scrypt(code, salt, expected.length)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function generateAccessCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
