import { getMenu } from "@/app/actions/online-order";
import { TakeawayMenuClient } from "@/components/takeaway/takeaway-menu-client";

export const dynamic = "force-dynamic";

export default async function TakeawayMenuPage() {
  const categories = await getMenu();
  return <TakeawayMenuClient categories={categories} />;
}
