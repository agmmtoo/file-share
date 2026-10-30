import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, ...props }: InputPrimitive.Props) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-none border-2 border-brutal bg-background px-2.5 text-xs text-foreground transition-all duration-150 ease-(--ease-brutal) outline-none",
        "selection:bg-brand selection:text-brand-foreground placeholder:text-muted-foreground/70",
        "focus-visible:-translate-x-0.5 focus-visible:-translate-y-0.5 focus-visible:shadow-brutal-sm",
        "disabled:pointer-events-none disabled:opacity-60",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
