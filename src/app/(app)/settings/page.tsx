import { redirect } from "next/navigation";

export default function SettingsPage() {
  // Roles & permissions moved to the HR module; land on a general setting.
  redirect("/settings/tables");
}
