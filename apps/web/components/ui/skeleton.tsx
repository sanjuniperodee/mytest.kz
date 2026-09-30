import { cn } from '@/lib/utils'

/** Soft shimmer placeholder (the sweep is disabled under prefers-reduced-motion). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('skeleton-shimmer bg-muted rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
