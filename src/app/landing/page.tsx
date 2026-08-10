import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Machimoto",
  description: "Machimoto — cafe.",
};

export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[#f6f1ea] px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-machimoto.svg"
        alt="Machimoto"
        className="w-[min(72vw,420px)] max-w-full"
      />

      <footer className="absolute bottom-6 text-xs tracking-wide text-[#422e4d]/45">
        © {new Date().getFullYear()} Machimoto
      </footer>
    </main>
  );
}
