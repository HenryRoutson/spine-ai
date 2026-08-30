// AI : SPINE_VIBE_AUTHORING=json is the opt-out; default is workflow TypeScript.
export type VibeAuthoringMode = "json" | "js"

export function vibeAuthoringMode(): VibeAuthoringMode {
  return process.env.SPINE_VIBE_AUTHORING === "json" ? "json" : "js"
}

export function vibeJsAuthoringEnabled(): boolean {
  return vibeAuthoringMode() === "js"
}
