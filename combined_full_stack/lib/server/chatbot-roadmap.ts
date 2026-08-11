// AI : prompted chatbot step — grep "TODO (chatbot" / "DONE (chatbot" for status.
//
// Locked structures (builtin_models.ts):
//   ChatbotPrompt { prompt: text }   — spine INPUT (operator-facing prompt)
//   ChatbotTurn { role, content }
//   ChatbotResult { prompt, transcript: list[ChatbotTurn], exit_reason }
//
// ModuleKind.Chatbot = "chatbot"
//   chatbotMode?: "single" | "until-exit"
//   model?: ModelId
//   maxTurns?: number
//   // NO module.prompt — prompt lives on spine input.prompt
//
// Stages:
// AI : DONE (chatbot-stage-A) — ModuleKind.Chatbot + fields + MODULE_META + factory (pin locked I/O structs)
// AI : DONE (chatbot-stage-A-struct) — BUILTIN_CHATBOT_PROMPT + TURN + RESULT in builtin_models
// AI : DONE (chatbot-stage-A-ui) — KIND_ICON/COLOR + USER_ADDABLE + pipeline-fields/chatbot-fields.tsx
// AI : DONE (chatbot-stage-A-api) — api_schemas chatbotMode/maxTurns; migrate pins locked I/O
// AI : DONE (chatbot-stage-B-pause) — ChatbotPendingError + linear/pipeline resume buildChatbotResult
// AI : DONE (chatbot-stage-C-exec) — steps/chatbot.ts + exec_module; turns via /chatbot-turn while paused
// AI : DONE (chatbot-stage-D-inference) — ChatbotPanel + onChatbot in run-engine / inference hooks
// AI : DONE (chatbot-stage-E-logging) — ChatbotResult in outputJson / preview (transcript via JSON view)
// AI : DONE (chatbot-stage-F-spine) — deriveIn/Out pinned; validity-sync normalize; not passthrough
// AI : DONE (chatbot-stage-G-export) — waitForChatbotSession stubs in TS/Py/Rs/Go + setup
// AI : DONE (chatbot-stage-H-testing) — testing + shared-link auto-exit empty transcript
// AI : DONE (chatbot-stage-I-assistant) — assistant-prompt builtins + chatbotMode on moduleSpecSchema

export {};
