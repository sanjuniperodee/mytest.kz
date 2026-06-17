import { cn } from "@/lib/utils"

function BrandCard({
  className,
  children,
  label,
}: {
  className?: string
  children: React.ReactNode
  label: string
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "inline-flex h-11 min-w-28 items-center justify-center rounded-xl border border-border bg-card px-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PaymentBrandStrip({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      <BrandCard label="Visa" className={compact ? "h-10 min-w-24" : undefined}>
        <span className="text-lg font-black uppercase tracking-tight text-[#1a1f71]">VISA</span>
      </BrandCard>

      <BrandCard label="Mastercard" className={compact ? "h-10 min-w-24" : undefined}>
        <span className="relative flex items-center justify-center">
          <span className="h-5 w-5 rounded-full bg-[#eb001b]/90" />
          <span className="-ml-2.5 h-5 w-5 rounded-full bg-[#f79e1b]/90" />
        </span>
      </BrandCard>

      <BrandCard label="Kaspi Pay" className={compact ? "h-10 min-w-24" : undefined}>
        <span className="text-sm font-bold tracking-tight text-[#ea0029]">Kaspi Pay</span>
      </BrandCard>

      <BrandCard label="Freedom Pay" className={compact ? "h-10 min-w-24" : undefined}>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Freedom <span className="text-emerald-600">Pay</span>
        </span>
      </BrandCard>
    </div>
  )
}
