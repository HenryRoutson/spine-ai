// AI : SPINE_VIBE_AUTHORING=js writes/compiles pipeline.js; default json is the live path.
export type VibeAuthoringMode = "json" | "js"

export function vibeAuthoringMode(): VibeAuthoringMode {
  return process.env.SPINE_VIBE_AUTHORING === "js" ? "js" : "json"
}

export function vibeJsAuthoringEnabled(): boolean {
  return vibeAuthoringMode() === "js"
}
