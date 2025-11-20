export function LogoIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <text
        x="18"
        y="18"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Space Grotesk', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont"
        fontSize="24"
        fontWeight="700"
        fill="#E6E2DC"
        transform="rotate(-90 18 18)"
      >S</text>
    </svg>
  )
}

export function Logo({ className = "text-lg font-medium tracking-tight not-italic" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-0 ${className}`}>
      <LogoIcon className="h-7 w-7 relative top-[3px]" />
      <span className="ml-[-5px] leading-none tracking-tight">uimo</span>
      <span className="sr-only">Suimo</span>
    </div>
  )
}
