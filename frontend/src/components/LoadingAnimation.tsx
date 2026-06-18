export default function LoadingAnimation({ width = 180, height = 180, label = 'Loading...' }: { width?: number; height?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        style={{ width, height }}
        className="flex items-center justify-center"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-secondary/20 border-b-secondary animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.6s' }} />
          </div>
        </div>
      </div>
      <span className="text-sm text-white/40">{label}</span>
    </div>
  );
}
