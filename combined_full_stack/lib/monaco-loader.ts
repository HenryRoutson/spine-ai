"use client"

import { loader } from "@monaco-editor/react"

// AI : CSP blocks cdn.jsdelivr.net — serve Monaco from public/monaco/vs (see ensure_monaco_public.mjs).
loader.config({ paths: { vs: "/monaco/vs" } })
