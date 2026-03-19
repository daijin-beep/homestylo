import { NextResponse, type NextRequest } from "next/server";
import { refreshAuthSession } from "@/lib/supabase/middleware";

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/upload",
  "/analyze",
  "/import",
  "/style",
  "/generate",
  "/result",
  "/compare",
  "/accounting",
  "/share",
  "/admin",
];

const PUBLIC_EXACT_ROUTES = new Set(["/", "/login", "/pricing"]);

function isPublicRoute(pathname: string) {
  return PUBLIC_EXACT_ROUTES.has(pathname) || pathname.startsWith("/s/");
}

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtectedRoute(pathname);

  if (!protectedRoute && isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const { response, user } = await refreshAuthSession(request);

  if (!protectedRoute) {
    return response;
  }

  if (user) {
    return response;
  }

  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set(
    "redirect",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
