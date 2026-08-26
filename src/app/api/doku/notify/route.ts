import { createClient } from "@supabase/supabase-js";
import { verifyDokuNotification } from "@/lib/payments";

// DOKU payment notification (webhook). Configure this URL in the DOKU dashboard:
//   https://order.machimoto.cafe/api/doku/notify
export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifyDokuNotification(req.headers, rawBody)) {
    return new Response("invalid signature", { status: 401 });
  }

  let body: { order?: { invoice_number?: string }; transaction?: { status?: string } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("bad body", { status: 400 });
  }

  const invoice = body.order?.invoice_number;
  const status = body.transaction?.status;
  if (!invoice) return new Response("ok", { status: 200 });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (status === "SUCCESS") {
    await db
      .from("online_orders")
      .update({ payment_status: "paid", status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("order_number", invoice)
      .neq("payment_status", "paid");
  } else if (status === "FAILED" || status === "EXPIRED") {
    await db
      .from("online_orders")
      .update({ payment_status: status === "EXPIRED" ? "expired" : "failed", updated_at: new Date().toISOString() })
      .eq("order_number", invoice)
      .eq("payment_status", "unpaid");
  }

  // Always 200 so DOKU stops retrying a handled notification.
  return new Response("ok", { status: 200 });
}
