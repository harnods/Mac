import Link from "next/link";
import { getOnlineOrder } from "@/app/actions/online-order";
import { TakeawayOrderView } from "@/components/takeaway/order-view";

export const dynamic = "force-dynamic";

export default async function TakeawayOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getOnlineOrder(token);

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">We couldn&rsquo;t find this order.</p>
        <Link href="/takeaway" className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Back to menu</Link>
      </div>
    );
  }

  return <TakeawayOrderView order={data.order} items={data.items} charge={data.charge} token={token} />;
}
