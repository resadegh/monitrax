import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // iOS Safari renders date/time inputs that have `display:flex` as
    // oversized empty boxes (a long-standing WebKit bug). The base style
    // below uses `flex` (needed for `file:` inputs), so for date-like types
    // we override to `block` — twMerge keeps the later display utility.
    const isDateLike =
      !!type && ["date", "time", "datetime-local", "month", "week"].includes(type)
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 sm:h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 sm:py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isDateLike && "block min-w-0 appearance-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
