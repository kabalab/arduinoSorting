// Route protection for Next.js 16. Unknown visitors go to the access-code screen,
// and members are turned away from /admin, including direct URLs.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/src/auth/token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/session/end") return NextResponse.next();

  let session = null;
  try {
    session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    session = null;
  }

  const loggingIn = pathname === "/";
  if (!session && !loggingIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (session && loggingIn) {
    const destination = session.role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }
  if (session?.role === "member" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
