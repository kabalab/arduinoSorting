import { cookies } from "next/headers";
import { SESSION_COOKIE, createSessionToken, readSessionToken, sessionCookieOptions, type SessionToken } from "./token";
import type { Role } from "@/src/domain/types";

export async function getSession(): Promise<SessionToken | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function setSession(userId: string, role: Role): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(userId, role), sessionCookieOptions);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
