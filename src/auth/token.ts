import type { Role } from "@/src/domain/types";

export const SESSION_COOKIE = "equipment_session";
const SESSION_DAYS = 14;

export type SessionToken = {
  userId: string;
  role: Role;
  /** Hash of the access code that opened this session. A rotated or removed code no longer matches. */
  codeHash: string;
  exp: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Copy .env.example to .env.local and set one.");
  }
  return secret;
}

export async function createSessionToken(
  userId: string,
  role: Role,
  codeHash: string,
  secret = sessionSecret(),
): Promise<string> {
  const payload: SessionToken = {
    userId,
    role,
    codeHash,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
  };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(body, secret);
  return `${body}.${signature}`;
}

export async function readSessionToken(token: string | undefined, secret?: string): Promise<SessionToken | null> {
  if (!token) return null;
  const key = secret ?? sessionSecret();
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await sign(body, key);
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as SessionToken;
    if (!payload.userId || !payload.codeHash || (payload.role !== "admin" && payload.role !== "member")) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
