import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("apple-skeleton rounded-xl bg-muted", className)}
      role="progressbar"
      aria-label="Loading content"
      {...props}
    />
  )
}

export { Skeleton }
