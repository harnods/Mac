"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeStockCount } from "@/app/actions/stock";

export function CompleteCountButton({ countId }: { countId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleComplete() {
    start(async () => {
      const res = await completeStockCount(countId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Stock count completed — on_hand updated");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleComplete} disabled={pending}>
        {pending ? "Completing..." : "Complete count"}
      </Button>
    </div>
  );
}
