// AI : SPINE_VIBE_AUTHORING=json is the old graph-JSON LLM path; default is Windmill-shaped JS.
export type VibeAuthoringMode = "json" | "js"

export function vibeAuthoringMode(): VibeAuthoringMode {
  return process.env.SPINE_VIBE_AUTHORING === "json" ? "json" : "js"
}

export function vibeJsAuthoringEnabled(): boolean {
  return vibeAuthoringMode() === "js"
}
