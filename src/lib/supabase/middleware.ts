import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = request.nextUrl;
  const { pathname } = url;
  const host = (request.headers.get("host") ?? "").toLowerCase();
  // Crew subdomain (me.machimoto.cafe) serves the /me/* app; every other host
  // (admin.machimoto.cafe, *.vercel.app, apex) serves the back-office.
  const isCrewHost = host.startsWith("me.");
  // Public take-away storefront (order.machimoto.cafe) → /takeaway/*.
  // (Dine-in lives at /order/* on the myorder host and is left untouched.)
  const isOrderHost = host.startsWith("order.");
  // Public recruitment apply page (hire.machimoto.cafe/<code>) → /apply/*.
  const isHireHost = host.startsWith("hire.");
  // Apex + www show a public placeholder landing page.
  const isApexHost = host === "machimoto.cafe" || host === "www.machimoto.cafe";

  const isInfraEarly =
    pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname === "/favicon.ico";
  if (isApexHost && !isInfraEarly) {
    const rw = url.clone();
    rw.pathname = "/landing";
    return NextResponse.rewrite(rw);
  }

  // Determine auth state purely from the Supabase session cookie — zero
  // network calls, no Edge Runtime timeout risk. Full token verification
  // and session refresh happen in Server Components via getUser().
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const hasSession =
    request.cookies.has(cookieName) || request.cookies.has(`${cookieName}.0`);

  const isInfra =
    pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname === "/favicon.ico";

  // --- Order subdomain: map the root onto /order/*, fully public (no auth) ---
  if (isOrderHost && !isInfra) {
    const target = pathname.startsWith("/takeaway")
      ? pathname
      : pathname === "/"
        ? "/takeaway"
        : `/takeaway${pathname}`;
    if (target !== pathname) {
      const rw = url.clone();
      rw.pathname = target;
      return NextResponse.rewrite(rw);
    }
    return NextResponse.next({ request });
  }

  // --- Hire subdomain: map the root onto /apply/*, fully public (no auth) ---
  if (isHireHost && !isInfra) {
    const target = pathname.startsWith("/apply")
      ? pathname
      : pathname === "/"
        ? "/apply"
        : `/apply${pathname}`;
    if (target !== pathname) {
      const rw = url.clone();
      rw.pathname = target;
      return NextResponse.rewrite(rw);
    }
    return NextResponse.next({ request });
  }

  // --- Crew subdomain: map the root onto the /me/* routes ---
  if (isCrewHost && !isInfra) {
    // "/" -> "/me", "/login" -> "/me/login", "/overtime" -> "/me/overtime".
    // Paths already under /me pass through unchanged (no double prefix).
    const target = pathname.startsWith("/me")
      ? pathname
      : pathname === "/"
        ? "/me"
        : `/me${pathname}`;

    const isPublic = target === "/me/login";
    if (!hasSession && !isPublic) {
      const redir = url.clone();
      redir.pathname = "/login"; // resolves to /me/login on the next pass
      redir.searchParams.set("next", pathname);
      return NextResponse.redirect(redir);
    }
    if (target !== pathname) {
      const rw = url.clone();
      rw.pathname = target;
      return NextResponse.rewrite(rw);
    }
    return NextResponse.next({ request });
  }

  // --- Back-office (admin.* and every other host) ---
  const isPublic =
    pathname === "/login" ||
    pathname === "/me/login" ||
    pathname === "/order" ||
    pathname.startsWith("/order/") ||
    pathname === "/takeaway" ||
    pathname.startsWith("/takeaway/") ||
    pathname === "/apply" ||
    pathname.startsWith("/apply/") ||
    pathname === "/landing" ||
    isInfra;

  // Crew paths reached on a non-crew host still use the crew login.
  const isCrewPath = pathname === "/me" || pathname.startsWith("/me/");

  if (!hasSession && !isPublic) {
    const redir = url.clone();
    redir.pathname = isCrewPath ? "/me/login" : "/login";
    redir.searchParams.set("next", pathname);
    return NextResponse.redirect(redir);
  }

  return NextResponse.next({ request });
}
