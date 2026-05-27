"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setItemSellable } from "@/app/actions/inventory";

export function SellableToggleButton({ id, isSellable }: { id: string; isSellable: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function handleToggle(checked: boolean) {
    start(async () => {
      const res = await setItemSellable(id, checked);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(checked ? "Available for sale as ala-carte" : "Removed from ala-carte sale");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="sellable-toggle"
        checked={isSellable}
        onCheckedChange={handleToggle}
        disabled={pending}
      />
      <Label htmlFor="sellable-toggle" className="text-sm cursor-pointer">
        Available for sale as ala-carte
      </Label>
    </div>
  );
}
