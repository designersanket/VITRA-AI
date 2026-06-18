export default function SimpleLoader({ size = 18, className = '' }: { size?: number; className?: string }) {
  const sx = { width: size, height: size } as any;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      style={sx}
      className={`animate-spin ${className}`}
      fill="none"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="4" strokeOpacity="0.2" />
      <path d="M22 12a10 10 0 00-10-10" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
