interface LevelBadgeProps {
  level: number;
  size?: 'xs' | 'sm';
  className?: string;
}

export function LevelBadge({ level, size = 'sm', className = '' }: LevelBadgeProps) {
  const base =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0'
      : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 ${base} ${className}`}
    >
      ⭐ {level}
    </span>
  );
}
