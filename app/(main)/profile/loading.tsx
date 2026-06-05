export default function ProfileLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-surface-card shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-surface-card rounded-lg w-1/2" />
          <div className="h-4 bg-surface-card rounded-lg w-2/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-surface-card rounded-2xl" />
        <div className="h-24 bg-surface-card rounded-2xl" />
        <div className="h-24 bg-surface-card rounded-2xl" />
        <div className="h-24 bg-surface-card rounded-2xl" />
      </div>
      <div className="h-12 bg-surface-card rounded-xl" />
    </div>
  );
}
