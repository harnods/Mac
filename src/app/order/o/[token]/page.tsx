import Link from "next/link";
import { getOnlineOrder } from "@/app/actions/online-order";
import { OrderView } from "@/components/order/order-view";

export const dynamic = "force-dynamic";

export default async function OrderStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getOnlineOrder(token);

  if (!data) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-stone-500">We couldn&rsquo;t find this order.</p>
          <Link href="/order" className="mt-4 inline-block rounded-full bg-orange-500 px-5 py-2.5 font-semibold text-white">Back to menu</Link>
        </div>
      </div>
    );
  }

  return <OrderView order={data.order} items={data.items} charge={data.charge} token={token} />;
}
