"use client"

import { useEffect, useRef, type ElementType, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { REMOVAL_EXIT_MS } from "@/lib/use-animated-removal"

type AnimatedRemovalItemProps = HTMLAttributes<HTMLElement> & {
  itemId: string
  isExiting: boolean
  as?: ElementType
  children: ReactNode
}

export function AnimatedRemovalItem({
  itemId,
  isExiting,
  as: Tag = "li",
  className,
  children,
  ...props
}: AnimatedRemovalItemProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !isExiting) return

    const height = el.scrollHeight
    el.style.maxHeight = `${height}px`
    el.style.opacity = "1"
    el.style.overflow = "hidden"
    el.style.transition = `max-height ${REMOVAL_EXIT_MS}ms ease-out, opacity ${REMOVAL_EXIT_MS}ms ease-out, padding ${REMOVAL_EXIT_MS}ms ease-out, margin ${REMOVAL_EXIT_MS}ms ease-out`

    const raf = requestAnimationFrame(() => {
      el.style.maxHeight = "0px"
      el.style.opacity = "0"
      el.style.paddingTop = "0"
      el.style.paddingBottom = "0"
      el.style.marginTop = "0"
      el.style.marginBottom = "0"
    })

    return () => cancelAnimationFrame(raf)
  }, [isExiting, itemId])

  useEffect(() => {
    const el = ref.current
    if (!el || isExiting) return
    el.style.maxHeight = ""
    el.style.opacity = ""
    el.style.overflow = ""
    el.style.transition = ""
    el.style.paddingTop = ""
    el.style.paddingBottom = ""
    el.style.marginTop = ""
    el.style.marginBottom = ""
  }, [isExiting, itemId])

  return (
    <Tag
      ref={ref}
      className={cn(isExiting && "pointer-events-none", className)}
      aria-hidden={isExiting || undefined}
      {...props}
    >
      {children}
    </Tag>
  )
}
