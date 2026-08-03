import * as React from "react"

import { cn } from "@/lib/utils"
const HAS_ARABIC_DIGITS = /[\u0660-\u0669\u06f0-\u06f9]/

// Free text: convert Arabic digits to Latin but keep punctuation
// (commas etc.) untouched — unlike numeric fields.
function digitsOnlyToEn(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onChange, ...props }, ref) => {
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (HAS_ARABIC_DIGITS.test(e.target.value)) {
        const pos = e.target.selectionStart
        e.target.value = digitsOnlyToEn(e.target.value)
        if (pos !== null) e.target.setSelectionRange(pos, pos)
      }
      onChange?.(e)
    },
    [onChange]
  )
  return (
    <textarea
      onChange={handleChange}
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
