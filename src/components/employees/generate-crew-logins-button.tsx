"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateCrewLogins } from "@/app/actions/crew-accounts";

export function GenerateCrewLoginsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await generateCrewLogins();
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${res.created} login(s) created, ${res.skipped} skipped`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><KeyRound className="size-4" /> Generate logins</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate crew logins</DialogTitle>
          <DialogDescription>
            Creates a login for every active crew who doesn&rsquo;t have one — email <code className="rounded bg-muted px-1">firstname-crew@machimoto.local</code>, password <code className="rounded bg-muted px-1">crew-2026</code> (they must change it on first login). Resigned crew are skipped.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button onClick={run} disabled={pending}>{pending ? "Generating..." : "Generate"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
