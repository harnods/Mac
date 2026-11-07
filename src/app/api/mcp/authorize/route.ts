import { encryptAuthCode } from "@/lib/mcp/oauth";

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token, user_id, redirect_uri, state } =
      await req.json();

    if (!access_token || !refresh_token || !user_id || !redirect_uri) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    const code = encryptAuthCode({ access_token, refresh_token, user_id });

    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);

    return Response.json({ redirect_url: url.toString() });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
