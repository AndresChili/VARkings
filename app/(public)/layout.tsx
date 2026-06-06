export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-lg mx-auto">{children}</main>
    </div>
  );
}
