import { redirect } from "next/navigation";

export default function InventoryLocationsRedirect() {
  redirect("/settings/locations");
}
