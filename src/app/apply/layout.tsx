import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Machimoto — Lowongan Kerja",
  description: "Lamar posisi di Machimoto.",
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background flex flex-col shadow-sm">
        {children}
      </div>
    </div>
  );
}
