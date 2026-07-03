import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname === "/order" ||
    pathname.startsWith("/order/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/");

  // Determine auth state purely from the Supabase session cookie — zero
  // network calls, no Edge Runtime timeout risk. Full token verification
  // and session refresh happen in Server Components via getUser().
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const hasSession =
    request.cookies.has(cookieName) ||
    request.cookies.has(`${cookieName}.0`);

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
