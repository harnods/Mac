import { OrdersPipelinePage } from "../pipeline-page";

export const dynamic = "force-dynamic";

export default async function BarOrdersPage() {
  return <OrdersPipelinePage view="bar" />;
}
