"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OrderStartPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function start(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 8) {
      setError("Masukkan nomor WhatsApp yang valid");
      return;
    }
    sessionStorage.setItem("order_phone", phone.trim());
    sessionStorage.setItem("order_name", name.trim());
    router.push("/order/menu");
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Pesan</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan nomor WhatsApp untuk mulai memesan.
        </p>
      </div>

      <form onSubmit={start} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="phone">No. WhatsApp</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("");
            }}
            className="h-12 text-base"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            Nama <span className="text-muted-foreground font-normal">(opsional)</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 text-base"
          />
        </div>

        <Button type="submit" className="w-full h-12 text-base">
          Lihat Menu
        </Button>
      </form>
    </div>
  );
}
