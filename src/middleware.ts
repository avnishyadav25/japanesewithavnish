import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Bundle store stays hidden until the one-time-purchase flow relaunches.
// Order/checkout/thank-you/payment routes must stay public — the
// subscription checkout redirects buyers through them.
const SALES_ROUTES = ["/store", "/product"];

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_session")?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return adminEmails.includes((payload.email as string)?.toLowerCase() ?? "");
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const { pathname } = request.nextUrl;
  const isSalesRoute = SALES_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (isSalesRoute) {
    const admin = await isAdminRequest(request);
    if (!admin) {
      return NextResponse.rewrite(new URL("/_not-found", request.url));
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
