import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "civicfix_session";

interface SessionUser {
  userId: string;
  name: string;
  email: string;
  role: "citizen" | "officer" | "worker" | "admin";
  departmentId?: string | null;
  exp?: number;
}

function parseSessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const jsonStr = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(jsonStr) as SessionUser;

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and internal next routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/verify") ||
    pathname.startsWith("/api/track") ||
    pathname.includes(".") || // files like favicon.ico, images
    pathname === "/offline" ||
    pathname === "/forbidden"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const user = parseSessionToken(sessionCookie?.value);

  // Protected route prefixes
  const isCitizenRoute = pathname.startsWith("/citizen");
  const isOfficerRoute = pathname.startsWith("/officer");
  const isWorkerRoute = pathname.startsWith("/worker");
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedRoute = isCitizenRoute || isOfficerRoute || isWorkerRoute || isAdminRoute;

  // If visiting protected route without session, redirect to login
  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user is logged in and visits /login or /register, redirect to their role home
  if (user && (pathname === "/login" || pathname === "/register")) {
    const roleHome = `/${user.role}`;
    return NextResponse.redirect(new URL(roleHome, request.url));
  }

  // Check role authorization for protected routes
  if (user && isProtectedRoute) {
    const role = user.role;

    if (isCitizenRoute && role !== "citizen") {
      return NextResponse.redirect(new URL(`/${role}?error=unauthorized`, request.url));
    }
    if (isOfficerRoute && role !== "officer") {
      return NextResponse.redirect(new URL(`/${role}?error=unauthorized`, request.url));
    }
    if (isWorkerRoute && role !== "worker") {
      return NextResponse.redirect(new URL(`/${role}?error=unauthorized`, request.url));
    }
    if (isAdminRoute && role !== "admin") {
      return NextResponse.redirect(new URL(`/${role}?error=unauthorized`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/citizen/:path*",
    "/officer/:path*",
    "/worker/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
