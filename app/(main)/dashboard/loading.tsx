export default function DashboardLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-pulse">
      <div className="h-7 bg-surface-card rounded-lg w-1/3" />
      <div className="h-32 bg-surface-card rounded-2xl" />
      <div className="h-7 bg-surface-card rounded-lg w-1/4 mt-2" />
      <div className="h-20 bg-surface-card rounded-2xl" />
      <div className="h-20 bg-surface-card rounded-2xl" />
      <div className="h-20 bg-surface-card rounded-2xl" />
    </div>
  );
}
