export default function FriendsLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-pulse">
      <div className="h-11 bg-surface-card rounded-2xl" />
      <div className="h-4 bg-surface-card rounded w-1/3" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 bg-surface-card rounded-2xl p-4">
          <div className="w-11 h-11 rounded-full bg-surface shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface rounded w-1/3" />
            <div className="h-3 bg-surface rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
