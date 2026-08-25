import { Check, Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/hooks/use-copy"
import { cn } from "@/lib/utils"

export function CopyButton({
  url,
  className,
}: {
  url: string
  className?: string
}) {
  const { copied, failed, copy } = useCopy(url)

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={copy}
      aria-label={copied ? "Link copied" : failed ? "Copy failed" : "Copy link"}
      className={cn(
        copied && "bg-success text-success-foreground",
        failed && "bg-destructive text-white",
        className
      )}
    >
      {/* Both icons stay mounted so the swap can animate. */}
      <span className="relative grid size-4 place-items-center">
        {failed ? (
          <X className="col-start-1 row-start-1" />
        ) : (
          <>
            <Copy
              className={cn(
                "col-start-1 row-start-1 transition-all duration-200",
                copied ? "scale-50 opacity-0" : "scale-100 opacity-100"
              )}
            />
            <Check
              className={cn(
                "col-start-1 row-start-1 transition-all duration-200",
                copied ? "scale-100 opacity-100" : "scale-50 opacity-0"
              )}
            />
          </>
        )}
      </span>
    </Button>
  )
}
