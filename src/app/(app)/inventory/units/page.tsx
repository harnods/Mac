import { redirect } from "next/navigation";

export default function InventoryUnitsRedirect() {
  redirect("/settings/units");
}
