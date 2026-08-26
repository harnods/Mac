import type { Metadata } from "next";
import { CartProvider } from "@/components/order/cart";

export const metadata: Metadata = {
  title: "Machimoto — Order & Pick up",
  description: "Order your Machimoto favourites for take-away and skip the queue.",
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-dvh bg-stone-100 text-stone-900">
        <div className="mx-auto min-h-dvh w-full max-w-md bg-stone-50 shadow-xl shadow-stone-200/60">
          {children}
        </div>
      </div>
    </CartProvider>
  );
}
