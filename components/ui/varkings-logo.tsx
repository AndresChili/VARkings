import Image from 'next/image';

interface VarkingsLogoProps {
  size?: number;
  className?: string;
}

export function VarkingsLogo({ size = 48, className = '' }: VarkingsLogoProps) {
  return (
    <Image
      src="/icons/icon-192x192.png"
      alt="VARkings"
      width={size}
      height={size}
      className={`rounded-2xl ${className}`}
      priority
    />
  );
}

export function VarkingsWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-black tracking-tight bg-gradient-to-r from-crown-light via-crown to-crown-dark bg-clip-text text-transparent ${className}`}
    >
      VARkings
    </span>
  );
}
