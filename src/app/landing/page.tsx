import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Machimoto",
  description: "Machimoto — cafe.",
};

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#1a120b] px-6 text-center text-[#f3e9dd]">
      <div className="flex flex-col items-center gap-6">
        {/* Placeholder mark — swap for the real logo when ready */}
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[#c98a4b]">
          <path
            d="M4 9h11v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M15 10h2.5a2.5 2.5 0 0 1 0 5H15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 3c-.6.8-.6 1.7 0 2.5M10.5 3c-.6.8-.6 1.7 0 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4 21h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Machimoto</h1>
          <p className="mt-1 text-sm uppercase tracking-[0.35em] text-[#c98a4b]">cafe</p>
        </div>

        <p className="max-w-sm text-sm text-[#f3e9dd]/70">Coming soon.</p>
      </div>

      <footer className="absolute bottom-6 text-xs text-[#f3e9dd]/40">
        © {new Date().getFullYear()} Machimoto
      </footer>
    </main>
  );
}
