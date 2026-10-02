import { timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateAccessCode, hashAccessCode } from "@/src/auth/codes";
import type { StoreData, User } from "@/src/domain/types";
import { CODES_PATH } from "./seed";

/** Gitignored. Created once, then left read-only so the app cannot replace it. */
export const RESET_CODE_PATH = path.join(process.cwd(), "data", "reset-code.txt");

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

const SEEDED_USER_IDS: Record<string, string> = {
  admin: "user-admin",
  administrators: "user-admin",
  arduino: "user-arduino",
  robotics: "user-robotics",
};

export type DefaultCode = { userId: string; code: string };

export type ResetFile = {
  resetCode: string;
  defaults: DefaultCode[];
};

export function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseResetFile(text: string): ResetFile | null {
  let resetCode = "";
  const defaults: DefaultCode[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [id, code] = line.split(/\s+/);
    if (!id || !code || !CODE_PATTERN.test(code)) continue;
    if (id === "reset") resetCode = code;
    else if (!defaults.some((entry) => entry.userId === id)) defaults.push({ userId: id, code });
  }
  if (!resetCode) return null;
  return { resetCode, defaults };
}

/** Maps the one-time lines in data/initial-codes.txt onto people in the store. */
export function defaultsFromInitialCodes(text: string, users: User[]): DefaultCode[] {
  const defaults: DefaultCode[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const parts = raw.split(" — ").map((part) => part.trim());
    if (parts.length < 3) continue;
    const label = parts[0] ?? "";
    const name = parts[1] ?? "";
    const code = parts[parts.length - 1] ?? "";
    if (!CODE_PATTERN.test(code)) continue;
    const userId = matchDefaultUser(users, label, name);
    if (!userId || defaults.some((entry) => entry.userId === userId)) continue;
    defaults.push({ userId, code });
  }
  return defaults;
}

function matchDefaultUser(users: User[], label: string, name: string): string | null {
  const seededId = SEEDED_USER_IDS[label.toLowerCase()];
  if (seededId && users.some((user) => user.id === seededId)) return seededId;
  return users.find((user) => user.displayName === name)?.id ?? null;
}

export function applyDefaultCodes(
  store: StoreData,
  defaults: { userId: string; code: string; codeHash: string }[],
): { store: StoreData; restored: number } {
  const next = structuredClone(store);
  let restored = 0;
  for (const entry of defaults) {
    const credential = next.credentials.find((item) => item.userId === entry.userId);
    if (!credential) continue;
    credential.code = entry.code;
    credential.codeHash = entry.codeHash;
    restored += 1;
  }
  return { store: next, restored };
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
 * Writes the reset code and the original access codes on the first call.
 * If the file is already there, it is left untouched.
 */
export async function ensureResetFile(
  users: User[],
  source?: { defaults?: DefaultCode[] },
  filePath = RESET_CODE_PATH,
): Promise<void> {
  if ((await readOptional(filePath)) !== null) return;

  const provided = (source?.defaults ?? []).filter((entry) => CODE_PATTERN.test(entry.code));
  const defaults =
    provided.length > 0
      ? provided
      : defaultsFromInitialCodes((await readOptional(CODES_PATH)) ?? "", users);
  if (defaults.length === 0) {
    console.warn(`Reset code was not created. No original access codes were found in ${CODES_PATH}.`);
    return;
  }

  const used = new Set(defaults.map((entry) => entry.code));
  let resetCode = generateAccessCode();
  while (used.has(resetCode)) resetCode = generateAccessCode();

  const body = [
    "# Created once. This file stays on this machine and is not part of the repo.",
    "# The app will not change it. Enter the reset code on the login screen to restore the access codes below.",
    `reset ${resetCode}`,
    ...defaults.map((entry) => `${entry.userId} ${entry.code}`),
    "",
  ].join("\n");

  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await writeFile(filePath, body, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
    throw error;
  }
  try {
    await chmod(filePath, 0o444);
  } catch {
    // The file is still written only once.
  }
  console.info(`Reset code saved to ${filePath}. It is not stored in the repo.`);
}

export async function readResetFile(filePath = RESET_CODE_PATH): Promise<ResetFile | null> {
  const text = await readOptional(filePath);
  if (!text) return null;
  return parseResetFile(text);
}

export async function isResetCode(code: string, filePath = RESET_CODE_PATH): Promise<boolean> {
  const parsed = await readResetFile(filePath);
  if (!parsed) return false;
  return sameSecret(code, parsed.resetCode);
}

export async function hashedDefaults(
  filePath = RESET_CODE_PATH,
): Promise<{ userId: string; code: string; codeHash: string }[] | null> {
  const parsed = await readResetFile(filePath);
  if (!parsed || parsed.defaults.length === 0) return null;
  return Promise.all(
    parsed.defaults.map(async (entry) => ({
      userId: entry.userId,
      code: entry.code,
      codeHash: await hashAccessCode(entry.code),
    })),
  );
}
