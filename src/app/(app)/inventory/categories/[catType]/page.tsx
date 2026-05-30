import { redirect } from "next/navigation";

export default async function InventoryCategoryRedirect({
  params,
}: {
  params: Promise<{ catType: string }>;
}) {
  const { catType } = await params;
  redirect(`/settings/categories/${catType}`);
}
