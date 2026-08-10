"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setProductStatus } from "@/app/actions/inventory";

export function ProductStatusButton({ id, status }: { id: string; status: "active" | "draft" }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const isDraft = status === "draft";

  function handleToggle() {
    const next = isDraft ? "active" : "draft";
    start(async () => {
      const res = await setProductStatus(id, next);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(next === "active" ? "Product published" : "Set as draft");
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleToggle} disabled={pending}>
      {pending ? "Saving..." : isDraft ? "Publish" : "Set as draft"}
    </Button>
  );
}
