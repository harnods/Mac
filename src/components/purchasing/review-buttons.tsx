"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reviewPurchaseRequest } from "@/app/actions/purchasing";

export function ReviewButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();

  function review(action: "approved" | "rejected") {
    start(async () => {
      const res = await reviewPurchaseRequest(id, action);
      if (!res.ok) toast.error(res.error);
      else toast.success(action === "approved" ? "Request approved" : "Request rejected");
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => review("approved")}>
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => review("rejected")}>
        Reject
      </Button>
    </div>
  );
}
