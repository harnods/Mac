export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background flex flex-col shadow-sm">
        {children}
      </div>
    </div>
  );
}
