import { OrdersPipelinePage } from "../pipeline-page";

export const dynamic = "force-dynamic";

export default async function KitchenOrdersPage() {
  return <OrdersPipelinePage view="kitchen" />;
}
