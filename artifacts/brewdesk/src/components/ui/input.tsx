import * as React from "react"

import { cn } from "@/lib/utils"
import { toEnDigits } from "@/lib/format"

const HAS_ARABIC_DIGITS = /[\u0660-\u0669\u06f0-\u06f9\u066b\u066c]/

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, inputMode, dir, ...props }, ref) => {
    // Browsers silently reject Arabic-Indic digits in type="number" inputs
    // (value becomes ""). Render numeric fields as text with a numeric
    // keyboard, and normalize any Arabic digits to Latin as the user types.
    const isNumeric = type === "number"

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (HAS_ARABIC_DIGITS.test(e.target.value)) {
          const pos = e.target.selectionStart
          // Numeric fields also normalize the Arabic decimal/grouping
          // separators; free-text fields only convert digits so commas
          // and other punctuation stay untouched.
          e.target.value = isNumeric
            ? toEnDigits(e.target.value)
            : e.target.value
                .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
          if (pos !== null) {
            try {
              e.target.setSelectionRange(pos, pos)
            } catch {
              // some input types don't support selection — ignore
            }
          }
        }
        onChange?.(e)
      },
      [onChange, isNumeric]
    )

    return (
      <input
        type={isNumeric ? "text" : type}
        inputMode={inputMode ?? (isNumeric ? "decimal" : undefined)}
        dir={dir ?? (isNumeric ? "ltr" : undefined)}
        onChange={handleChange}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
