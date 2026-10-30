import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** The small outlined chips that sit under a share's name. */
export function MetaBadge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode
  tone?: "default" | "brand"
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 border-2 border-brutal px-1.5 py-px text-[10px] font-bold tracking-widest uppercase",
        tone === "brand" ? "bg-brand text-brand-foreground" : "text-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}
