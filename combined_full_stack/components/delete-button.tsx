"use client"

import { Loader2, Trash2 } from "lucide-react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DeleteButtonProps = ComponentProps<typeof Button> & {
  deleting?: boolean
  label?: string
}

export function DeleteButton({
  deleting = false,
  label,
  className,
  disabled,
  children,
  ...props
}: DeleteButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || deleting}
      aria-label={label}
      aria-busy={deleting || undefined}
      className={cn("text-destructive hover:text-destructive", className)}
    >
      {deleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        children ?? <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}
