export function SectionDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`relative mx-auto max-w-6xl ${className}`}>
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/10" />
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <span className="absolute -left-1 top-1/2 -translate-y-1/2 block h-2 w-2 rotate-45 border border-white/40 rounded-[2px]" />
      <span className="absolute -right-1 top-1/2 -translate-y-1/2 block h-2 w-2 rotate-45 border border-white/40 rounded-[2px]" />
      <span className="sr-only">Section divider</span>
    </div>
  );
}
