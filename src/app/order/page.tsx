import { getMenu } from "@/app/actions/online-order";
import { Storefront } from "@/components/order/storefront";

export const dynamic = "force-dynamic";

export default async function OrderMenuPage() {
  const categories = await getMenu();
  return <Storefront categories={categories} />;
}
