"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { setCrewLogin } from "@/app/actions/employees";

export function CrewLoginButton({ employeeId, currentEmail }: { employeeId: string; currentEmail: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const res = await setCrewLogin(employeeId, email.trim());
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(currentEmail ? "Login diperbarui" : "Login dibuat");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => setEmail(currentEmail ?? "")}>
          {currentEmail ? "Change login" : "Set login"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{currentEmail ? "Change crew login" : "Set crew login"}</DialogTitle>
          <DialogDescription>
            Email untuk login crew di me.machimoto.cafe. Password direset ke{" "}
            <span className="font-medium">crew-2026</span> dan wajib diganti saat login berikutnya.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="crew-login-email">Login email</Label>
          <Input
            id="crew-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="crew@email.com"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
