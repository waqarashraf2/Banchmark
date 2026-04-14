interface BenchmarkLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: 14 },
  md: { icon: 36, text: 18 },
  lg: { icon: 48, text: 24 },
};

export default function BenchmarkLogo({ size = 'md', showText = false, className = '' }: BenchmarkLogoProps) {
  const s = sizes[size];
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo Icon - K shape */}
      <svg 
        width={s.icon} 
        height={s.icon} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Orange vertical bar */}
        <rect x="4" y="4" width="10" height="40" rx="1" fill="#C45C26" />
        
        {/* Teal upper triangle */}
        <path d="M18 4L18 24L38 4H18Z" fill="#2AA7A0" />
        
        {/* Teal lower triangle */}
        <path d="M18 24L18 44L38 44L18 24Z" fill="#2AA7A0" />
      </svg>
      
      {showText && (
        <span 
          className="font-semibold tracking-tight"
          style={{ fontSize: s.text, color: '#2AA7A0' }}
        >
          BENCHMARK
        </span>
      )}
    </div>
  );
}
