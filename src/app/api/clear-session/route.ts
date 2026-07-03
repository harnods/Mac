import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  const loginUrl = new URL("/login", request.url);
  const res = NextResponse.redirect(loginUrl);
  for (const c of all) {
    if (c.name.startsWith("sb-")) {
      res.cookies.delete(c.name);
    }
  }
  return res;
}
