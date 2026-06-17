import { cn } from "@/lib/utils"

/**
 * Consistent dashboard page heading: optional eyebrow chip (icon + label),
 * a title, an optional description, and an optional actions slot on the right.
 */
export function PageHeader({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  eyebrowIcon?: React.ElementType
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {eyebrow && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {EyebrowIcon && <EyebrowIcon className="size-3" aria-hidden="true" />}
            {eyebrow}
          </span>
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
