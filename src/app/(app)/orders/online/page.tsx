import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getOnlineOrders } from "@/app/actions/online-order";
import { OnlineOrdersBoard } from "@/components/orders/online-orders-board";

export const dynamic = "force-dynamic";

export default async function OnlineOrdersPage() {
  const profile = await getCurrentProfile();
  if (!can(profile, P.SALES_READ) && !can(profile, P.SALES_WRITE)) {
    return <p className="text-sm text-muted-foreground">You don&rsquo;t have access to online orders.</p>;
  }
  const orders = await getOnlineOrders();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Online orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Take-away orders from order.machimoto.cafe — prep and hand off by pickup code.</p>
      </div>
      <OnlineOrdersBoard orders={orders} />
    </div>
  );
}
