"use client"

import * as React from "react"
import { Bot, Loader2, Send, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"

// AI : shadcn-chat-style primitives — shared across AssistantChat and human-review UIs.

function Chat({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat"
      className={cn("flex h-full min-h-0 flex-col bg-background", className)}
      {...props}
    />
  )
}

function ChatHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="chat-header" className={cn("border-b border-border px-4 py-3", className)} {...props} />
}

function ChatList({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <ScrollArea className={cn("h-full min-h-0 flex-1", className)} {...props}>
      <div data-slot="chat-list" className="space-y-4 p-4">
        {children}
      </div>
    </ScrollArea>
  )
}

type ChatBubbleVariant = "user" | "assistant"

const bubbleVariantClass: Record<ChatBubbleVariant, string> = {
  user: "border-border bg-secondary/70",
  assistant: "border-sky-500/35 bg-sky-500/15",
}

const avatarVariantClass: Record<ChatBubbleVariant, string> = {
  user: "border-border bg-secondary",
  assistant: "border-sky-400/40 bg-sky-500/25",
}

type ChatMessageProps = React.ComponentProps<"div"> & {
  variant: ChatBubbleVariant
}

function ChatMessage({ variant, className, children, ...props }: ChatMessageProps) {
  const isUser = variant === "user"
  return (
    <div
      data-slot="chat-message"
      data-variant={variant}
      className={cn(
        "flex gap-2 animate-in fade-in duration-300",
        isUser ? "slide-in-from-right-4 flex-row-reverse" : "slide-in-from-left-4 flex-row",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

type ChatBubbleProps = React.ComponentProps<"div"> & {
  variant: ChatBubbleVariant
}

function ChatBubble({ variant, className, children, ...props }: ChatBubbleProps) {
  return (
    <div
      data-slot="chat-bubble"
      className={cn(
        "min-w-0 max-w-[92%] rounded-lg border px-3 py-2",
        bubbleVariantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

type ChatBubbleAvatarProps = React.ComponentProps<"div"> & {
  variant: ChatBubbleVariant
}

function ChatBubbleAvatar({ variant, className, ...props }: ChatBubbleAvatarProps) {
  return (
    <div
      data-slot="chat-bubble-avatar"
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
        avatarVariantClass[variant],
        className,
      )}
      {...props}
    >
      {variant === "user" ? (
        <User className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <Bot className="h-3.5 w-3.5 text-sky-300" />
      )}
    </div>
  )
}

function ChatBubbleContent({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="chat-bubble-content"
      className={cn("text-xs leading-relaxed whitespace-pre-wrap break-words", className)}
      {...props}
    />
  )
}

type ChatTypingIndicatorProps = {
  label?: string
  className?: string
}

function ChatTypingIndicator({ label = "Thinking…", className }: ChatTypingIndicatorProps) {
  return (
    <div
      data-slot="chat-typing-indicator"
      className={cn("flex items-center gap-2 font-mono text-[10px] text-sky-200/70", className)}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </div>
  )
}

type ChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  sendLabel?: string
  className?: string
  footer?: React.ReactNode
}

function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = "Message…",
  disabled = false,
  sendLabel = "Send",
  className,
  footer,
}: ChatInputProps) {
  return (
    <div data-slot="chat-input" className={cn("border-t border-border", className)}>
      {footer}
      <div className="flex gap-2 p-3">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={placeholder}
          className="min-h-10 resize-none text-xs"
          rows={2}
          disabled={disabled}
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={!value.trim() || disabled}
          onClick={onSend}
          aria-label={sendLabel}
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">{sendLabel}</span>
        </Button>
      </div>
    </div>
  )
}

export {
  Chat,
  ChatHeader,
  ChatList,
  ChatMessage,
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleContent,
  ChatInput,
  ChatTypingIndicator,
}
