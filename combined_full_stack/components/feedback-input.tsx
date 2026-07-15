"use client"

import { useEffect, useState } from "react"
import { Loader2, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  feedbackModeAllowsText,
  feedbackModeAllowsVoice,
  type FeedbackInputMode,
  type UserFeedbackPayload,
} from "@/lib/feedback-types"
import { useVoiceInput, voiceInputSupported } from "@/lib/use-voice-input"

type FeedbackInputProps = {
  mode: FeedbackInputMode
  prompt?: string
  required?: boolean
  disabled?: boolean
  className?: string
  onChange: (payload: UserFeedbackPayload | undefined) => void
}

export function FeedbackInput({
  mode,
  prompt,
  required,
  disabled,
  className,
  onChange,
}: FeedbackInputProps) {
  const allowsText = feedbackModeAllowsText(mode)
  const allowsVoice = feedbackModeAllowsVoice(mode)
  const [activeMode, setActiveMode] = useState<"text" | "voice">(
    allowsText ? "text" : "voice",
  )
  const [text, setText] = useState("")
  const voice = useVoiceInput()

  useEffect(() => {
    if (mode === "both") return
    setActiveMode(allowsText ? "text" : "voice")
  }, [mode, allowsText])

  useEffect(() => {
    const body =
      activeMode === "voice"
        ? (voice.transcript.trim() || text.trim())
        : text.trim()
    if (!body) {
      onChange(undefined)
      return
    }
    onChange({
      mode: activeMode,
      text: body,
      transcript: activeMode === "voice" ? voice.transcript.trim() || undefined : undefined,
      at: Date.now(),
    })
  }, [activeMode, text, voice.transcript, onChange])

  const showModeToggle = mode === "both" && allowsText && allowsVoice

  return (
    <div className={cn("space-y-2", className)}>
      {prompt?.trim() && <p className="text-xs text-muted-foreground">{prompt.trim()}</p>}
      {showModeToggle && (
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={activeMode === "text" ? "default" : "outline"}
            className="h-7 px-2.5 text-[10px]"
            disabled={disabled}
            onClick={() => setActiveMode("text")}
          >
            Text
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeMode === "voice" ? "default" : "outline"}
            className="h-7 px-2.5 text-[10px]"
            disabled={disabled || !voice.supported}
            onClick={() => setActiveMode("voice")}
          >
            Voice
          </Button>
        </div>
      )}
      {activeMode === "text" && allowsText && (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={required ? "Feedback required…" : "Optional feedback…"}
          className="min-h-16 resize-none text-xs"
          rows={3}
          disabled={disabled}
        />
      )}
      {activeMode === "voice" && allowsVoice && (
        <div className="space-y-2">
          {!voiceInputSupported() && (
            <p className="font-mono text-[10px] text-muted-foreground">
              Voice input is not supported in this browser — use text instead.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={voice.listening ? "destructive" : "outline"}
              className="h-8 gap-1.5 text-[10px]"
              disabled={disabled || !voice.supported}
              onClick={voice.toggle}
            >
              {voice.listening ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              {voice.listening ? "Stop" : "Record"}
            </Button>
            {(voice.transcript || text) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-[10px]"
                disabled={disabled}
                onClick={() => {
                  voice.reset()
                  setText("")
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {(voice.transcript || text) && (
            <p className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap">
              {voice.transcript || text}
            </p>
          )}
          {voice.error && (
            <p className="font-mono text-[10px] text-destructive">{voice.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
