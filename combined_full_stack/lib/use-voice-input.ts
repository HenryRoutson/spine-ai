"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { feedback_transcript_string } from "@/lib/feedback-types"

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } }
}

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function voiceInputSupported(): boolean {
  return !!speechRecognitionCtor()
}

export function useVoiceInput(opts?: { lang?: string }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState<feedback_transcript_string>("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const supported = voiceInputSupported()

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = speechRecognitionCtor()
    if (!Ctor) {
      setError("Voice input is not supported in this browser")
      return
    }
    setError(null)
    recognitionRef.current?.abort()
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = opts?.lang ?? "en-US"
    rec.onresult = (ev) => {
      let full = ""
      for (let i = 0; i < ev.results.length; i++) {
        full += ev.results[i][0].transcript
      }
      setTranscript(full)
    }
    rec.onerror = (ev) => {
      if (ev.error !== "aborted") setError(ev.error)
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }, [opts?.lang])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  const reset = useCallback(() => {
    stop()
    setTranscript("")
    setError(null)
  }, [stop])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { supported, listening, transcript, error, start, stop, toggle, reset, setTranscript }
}
