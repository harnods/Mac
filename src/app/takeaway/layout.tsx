import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Machimoto — Grab & Go",
  description: "Order ahead for Grab & Go and pick up in store.",
};

export default function TakeawayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background flex flex-col shadow-sm">
        {children}
      </div>
    </div>
  );
}
