interface VarkingsLogoProps {
  size?: number;
  className?: string;
}

export function VarkingsLogo({ size = 48, className = '' }: VarkingsLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="50" fill="#1B4332" />

      {/* Football (soccer ball) */}
      <circle cx="50" cy="58" r="24" fill="#f8f8f8" stroke="#e0e0e0" strokeWidth="0.5" />

      {/* Pentagon pattern on football */}
      <polygon points="50,42 56,47 54,54 46,54 44,47" fill="#1a1a1a" />
      <polygon points="35,52 40,47 44,47 46,54 41,58" fill="#1a1a1a" />
      <polygon points="65,52 60,47 56,47 54,54 59,58" fill="#1a1a1a" />
      <polygon points="42,70 41,58 46,54 54,54 59,58 58,70" fill="#1a1a1a" />

      {/* Viking Crown */}
      {/* Crown base */}
      <rect x="22" y="30" width="56" height="14" rx="3" fill="#D4AF37" />

      {/* Crown spikes */}
      {/* Center spike */}
      <polygon points="50,4 44,20 56,20" fill="#D4AF37" />
      {/* Left spike */}
      <polygon points="32,10 27,24 37,24" fill="#D4AF37" />
      {/* Right spike */}
      <polygon points="68,10 63,24 73,24" fill="#D4AF37" />

      {/* Crown gems */}
      <circle cx="50" cy="10" r="4" fill="#2D6A4F" />
      <circle cx="32" cy="14" r="3" fill="#52B788" />
      <circle cx="68" cy="14" r="3" fill="#52B788" />

      {/* Crown decorative dots */}
      <circle cx="35" cy="37" r="2.5" fill="#B8960C" />
      <circle cx="50" cy="37" r="2.5" fill="#B8960C" />
      <circle cx="65" cy="37" r="2.5" fill="#B8960C" />
    </svg>
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
