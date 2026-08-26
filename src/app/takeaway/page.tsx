"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TakeawayStartPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function start(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 8) {
      setError("Enter a valid WhatsApp number");
      return;
    }
    if (!name.trim()) {
      setError("Enter your name for pickup");
      return;
    }
    sessionStorage.setItem("takeaway_phone", phone.trim());
    sessionStorage.setItem("takeaway_name", name.trim());
    router.push("/takeaway/menu");
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-8 space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/machimoto-logotype.svg" alt="Machimoto" className="h-7 w-auto" />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Take-away</h1>
          <p className="text-sm text-muted-foreground">
            Order ahead, pay with QRIS / e-wallet, and pick up in store.
          </p>
        </div>
      </div>

      <form onSubmit={start} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="phone">WhatsApp number</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(""); }}
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            className="h-12 text-base"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full h-12 text-base">
          View menu
        </Button>
      </form>
    </div>
  );
}
