export default function GroupLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 animate-pulse">
      <div className="h-8 bg-surface-card rounded-lg w-1/2" />
      <div className="h-7 bg-surface-card rounded-lg w-1/4" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 bg-surface-card rounded-2xl" />
      ))}
      <div className="h-7 bg-surface-card rounded-lg w-1/3 mt-2" />
      <div className="h-20 bg-surface-card rounded-2xl" />
      <div className="h-20 bg-surface-card rounded-2xl" />
    </div>
  );
}
