"use client"

import * as React from "react"
import {
  AtSign,
  Bot,
  Braces,
  Boxes,
  ClipboardPaste,
  Crosshair,
  FileText,
  History,
  Layers,
  Loader2,
  Maximize2,
  AlertTriangle,
  Send,
  User,
  Workflow,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  filterMentionOptions,
  findAtTrigger,
  groupMentionOptions,
  stripAtTrigger,
  type AssistantMentionGroup,
  type AssistantMentionOption,
  type AtTrigger,
} from "@/lib/assistant-mentions"
import {
  pasteChipPreview,
  pastedAttachmentFromClipboardText,
  shouldChipPaste,
  type PastedAttachment,
  type PastedAttachmentId,
} from "@/lib/pasted-attachment"

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
      <div data-slot="chat-list" className="space-y-3 px-3 py-3">
        {children}
      </div>
    </ScrollArea>
  )
}

type ChatBubbleVariant = "user" | "assistant"

// AI : Cursor-like neutrals — muted surfaces, no sky tint.
const bubbleVariantClass: Record<ChatBubbleVariant, string> = {
  user: "border-border/70 bg-muted/60",
  assistant: "border-border/40 bg-transparent",
}

const avatarVariantClass: Record<ChatBubbleVariant, string> = {
  user: "border-border bg-muted",
  assistant: "border-border/60 bg-muted/40",
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
        "flex w-full gap-2 animate-in fade-in duration-300",
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
        // AI : fill the chat column — no artificial 92% cap.
        "min-w-0 w-full flex-1 rounded-lg border px-3 py-2",
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
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
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
      className={cn("flex items-center gap-2 font-mono text-[10px] text-muted-foreground", className)}
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
  /** AI : chips / attachments above the textarea (ui-context pins). */
  attachments?: React.ReactNode
  /** AI : allow send when textarea empty but chips exist. */
  canSend?: boolean
  // AI : Cursor-style paste chips — long/multiline paste → removable chip (not inline wrap).
  // AI : Uses @assistant-ui/react SimpleTextAttachmentAdapter via pasted-attachment.ts.
  // AI : Also consider: Prompt Kit PromptInput; TipTap atoms; Lexical DecoratorNode;
  // AI :   full ComposerPrimitive.Attachments once we migrate off this textarea.
  pastes?: PastedAttachment[]
  onPastesChange?: React.Dispatch<React.SetStateAction<PastedAttachment[]>>
  // AI : TODO (assistant-@-mention) — caret-anchored popover position; TipTap inline @ tokens later.
  /** AI : @ menu candidates (steps / models / files / Select UI). */
  mentionOptions?: AssistantMentionOption[]
  onMentionPick?: (option: AssistantMentionOption) => void
}

const MENTION_GROUP_ICON: Record<
  AssistantMentionGroup,
  React.ComponentType<{ className?: string }>
> = {
  Actions: Crosshair,
  Issues: AlertTriangle,
  Runs: History,
  Cache: Layers,
  Steps: Workflow,
  Models: Boxes,
  Types: Braces,
  Files: FileText,
}

function MentionOptionIcon({ option }: { option: AssistantMentionOption }) {
  const Icon = MENTION_GROUP_ICON[option.group]
  return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}

function PastedChip({
  attachment,
  onRemove,
}: {
  attachment: PastedAttachment
  onRemove?: (id: PastedAttachmentId) => void
}) {
  const [fullscreen, setFullscreen] = React.useState(false)
  const closeFullscreen = React.useCallback(() => setFullscreen(false), [])

  React.useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen, closeFullscreen])

  React.useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  return (
    <>
      <span
        data-slot="pasted-chip"
        className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 font-mono text-[10px] text-foreground/90"
        title={attachment.text.slice(0, 500)}
      >
        <ClipboardPaste className="h-3 w-3 shrink-0 text-muted-foreground" />
        <button
          type="button"
          className="min-w-0 truncate text-left hover:text-foreground"
          onClick={() => setFullscreen(true)}
          title="View pasted text full screen"
        >
          {pasteChipPreview(attachment)}
        </button>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
          aria-label="View pasted text full screen"
          title="View full screen"
          onClick={() => setFullscreen(true)}
        >
          <Maximize2 className="h-3 w-3" />
        </button>
        {onRemove ? (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
            aria-label="Remove pasted attachment"
            onClick={() => onRemove(attachment.id)}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </span>

      {fullscreen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Pasted text"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-foreground">{attachment.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                Pasted · Esc to close
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={closeFullscreen}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground">
              {attachment.text}
            </pre>
          </div>
        </div>
      ) : null}
    </>
  )
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
  attachments,
  canSend,
  pastes,
  onPastesChange,
  mentionOptions,
  onMentionPick,
}: ChatInputProps) {
  const pasteList = pastes ?? []
  const pasteChipsEnabled = Boolean(onPastesChange)
  const mentionsEnabled = Boolean(mentionOptions && onMentionPick)
  const sendEnabled =
    canSend ?? Boolean(value.trim() || pasteList.length > 0)
  // AI : ClipboardEvent has no modifiers — track Shift for Cmd/Ctrl+Shift+V plain insert.
  const shiftDownRef = React.useRef(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [atTrigger, setAtTrigger] = React.useState<AtTrigger | null>(null)
  const [mentionIndex, setMentionIndex] = React.useState(0)

  const filteredMentions = React.useMemo(() => {
    if (!mentionsEnabled || !atTrigger || !mentionOptions) return []
    return filterMentionOptions(mentionOptions, atTrigger.query)
  }, [mentionsEnabled, atTrigger, mentionOptions])

  const groupedMentions = React.useMemo(
    () => groupMentionOptions(filteredMentions),
    [filteredMentions],
  )

  const mentionOpen = mentionsEnabled && atTrigger !== null
  const blurCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    setMentionIndex(0)
  }, [atTrigger?.query, atTrigger?.start])

  // AI : clamp highlight when the filtered list shrinks (options update while menu open).
  React.useEffect(() => {
    if (filteredMentions.length === 0) return
    setMentionIndex((i) => Math.min(i, filteredMentions.length - 1))
  }, [filteredMentions.length])

  React.useEffect(() => {
    return () => {
      if (blurCloseTimerRef.current) clearTimeout(blurCloseTimerRef.current)
    }
  }, [])

  function syncAtTriggerFromCaret(nextValue: string, caret: number) {
    if (!mentionsEnabled || disabled) {
      setAtTrigger(null)
      return
    }
    setAtTrigger(findAtTrigger(nextValue, caret))
  }

  function cancelBlurClose() {
    if (blurCloseTimerRef.current) {
      clearTimeout(blurCloseTimerRef.current)
      blurCloseTimerRef.current = null
    }
  }

  function pickMention(option: AssistantMentionOption) {
    if (!atTrigger || !onMentionPick) return
    const trigger = atTrigger
    const next = stripAtTrigger(value, trigger)
    onChange(next)
    setAtTrigger(null)
    onMentionPick(option)
    // AI : restore focus after chip pin (menu click blurs textarea).
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const caret = trigger.start
      el.setSelectionRange(caret, caret)
    })
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!pasteChipsEnabled || !onPastesChange || disabled) return
    if (shiftDownRef.current) return
    const text = e.clipboardData.getData("text/plain")
    if (!text || !shouldChipPaste(text)) return
    e.preventDefault()
    const attachment = await pastedAttachmentFromClipboardText(text)
    // AI : functional update — rapid pastes must not close over a stale pasteList.
    onPastesChange((prev) => [...prev, attachment])
  }

  function removePaste(id: PastedAttachmentId) {
    onPastesChange?.((prev) => prev.filter((p) => p.id !== id))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Shift") shiftDownRef.current = true
    // AI : don't steal Enter/Tab while IME composition is active (CJK etc.).
    if (e.nativeEvent.isComposing || e.key === "Process") return

    if (mentionOpen) {
      if (e.key === "Escape") {
        e.preventDefault()
        setAtTrigger(null)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (filteredMentions.length > 0) {
          setMentionIndex((i) => (i + 1) % filteredMentions.length)
        }
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (filteredMentions.length > 0) {
          setMentionIndex((i) => (i - 1 + filteredMentions.length) % filteredMentions.length)
        }
        return
      }
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault()
        if (filteredMentions.length === 0) {
          // AI : no matches — Esc-equivalent on Enter so send isn't soft-locked behind @query.
          if (e.key === "Enter") {
            setAtTrigger(null)
            if (sendEnabled && !disabled) onSend()
          }
          return
        }
        const option = filteredMentions[Math.min(mentionIndex, filteredMentions.length - 1)]
        if (option) pickMention(option)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (sendEnabled && !disabled) onSend()
    }
  }

  return (
    <div data-slot="chat-input" className={cn("border-t border-border", className)}>
      {footer}
      {attachments}
      {pasteList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {pasteList.map((p) => (
            <PastedChip key={p.id} attachment={p} onRemove={disabled ? undefined : removePaste} />
          ))}
        </div>
      ) : null}
      <div className="relative flex gap-2 p-3">
        {mentionOpen ? (
          <div
            data-slot="mention-menu"
            role="listbox"
            aria-label="Mention"
            className="absolute bottom-full left-3 z-20 mb-1 max-h-56 w-[min(100%-1.5rem,20rem)] overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
          >
            {filteredMentions.length === 0 ? (
              <p className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                No matches for @{atTrigger?.query}
              </p>
            ) : (
              groupedMentions.map(({ group, items }) => (
                <div key={group}>
                  <p className="sticky top-0 bg-popover/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {group}
                  </p>
                  {items.map((option) => {
                    const flatIndex = filteredMentions.findIndex((o) => o.id === option.id)
                    const active = flatIndex === mentionIndex
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "flex w-full items-start gap-2 px-2.5 py-1.5 text-left font-mono transition-colors",
                          active
                            ? "bg-muted text-foreground"
                            : "text-foreground/90 hover:bg-muted/60",
                        )}
                        onMouseDown={(ev) => {
                          // AI : prevent textarea blur before click registers.
                          ev.preventDefault()
                          pickMention(option)
                        }}
                        onMouseEnter={() => setMentionIndex(flatIndex)}
                      >
                        <MentionOptionIcon option={option} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px]">{option.label}</span>
                          {option.description ? (
                            <span className="block truncate text-[9px] text-muted-foreground">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                        {option.group === "Actions" ? (
                          <AtSign className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        ) : null}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            const next = e.target.value
            onChange(next)
            syncAtTriggerFromCaret(next, e.target.selectionStart ?? next.length)
          }}
          onSelect={(e) => {
            const el = e.currentTarget
            syncAtTriggerFromCaret(el.value, el.selectionStart ?? el.value.length)
          }}
          onClick={(e) => {
            const el = e.currentTarget
            syncAtTriggerFromCaret(el.value, el.selectionStart ?? el.value.length)
          }}
          onPaste={(e) => void handlePaste(e)}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => {
            if (e.key === "Shift") shiftDownRef.current = false
          }}
          onFocus={() => {
            cancelBlurClose()
          }}
          onBlur={() => {
            shiftDownRef.current = false
            // AI : delay close so mousedown on a menu row can fire first; cancel on re-focus.
            cancelBlurClose()
            blurCloseTimerRef.current = setTimeout(() => {
              blurCloseTimerRef.current = null
              setAtTrigger(null)
            }, 120)
          }}
          placeholder={placeholder}
          className="min-h-10 resize-none text-xs"
          rows={2}
          disabled={disabled}
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={!sendEnabled || disabled}
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
  PastedChip,
}
