import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_PATH_PREFIXES, SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Optimistische Zugangslenkung (Next.js 16 Proxy, früher Middleware):
 * Wer ohne Session-Cookie einen geschützten Bereich aufruft, landet direkt
 * beim Login — die verbindliche Prüfung (Session-Gültigkeit, Rolle, Status)
 * passiert anschliessend serverseitig in Layouts und Server Actions.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected || request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/passwort-aendern") {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/benutzer/:path*",
    "/audit/:path*",
    "/portal/:path*",
    "/passwort-aendern/:path*",
  ],
};
