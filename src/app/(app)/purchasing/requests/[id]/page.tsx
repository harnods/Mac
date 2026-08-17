import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The purchase request detail page has been removed — everything (view items,
// edit qty, assign supplier, approve/reject per item) now happens inline in the
// accordion on the requests list.
export default async function PurchaseRequestDetailPage() {
  redirect("/purchasing/requests");
}
