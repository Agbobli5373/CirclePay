export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-white ${className}`}>
      <div className="h-2 w-2 rounded-full bg-primary" />
    </div>
  )
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      <span className={`text-xl font-bold tracking-tight ${light ? 'text-white' : 'text-foreground'}`}>
        CirclePay
      </span>
    </div>
  )
}
