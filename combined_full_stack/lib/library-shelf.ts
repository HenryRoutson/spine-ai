// AI : picker shelves — same four buckets for pipelines and websites.

export type library_entity = "pipelines" | "websites"
export type library_shelf_id = "yours" | "shared" | "marketplace" | "templates"

export const LIBRARY_SHELVES: { id: library_shelf_id; title: string; hint: (entity: library_entity) => string }[] = [
  {
    id: "yours",
    title: "Yours",
    hint: (entity) => (entity === "websites" ? "Sites you created." : "Pipelines in this workspace."),
  },
  {
    id: "shared",
    title: "Shared with me",
    hint: (entity) =>
      entity === "websites"
        ? "Paste a /site/… link someone sent you."
        : "Paste a share link to run someone else's pipeline.",
  },
  {
    id: "marketplace",
    title: "Marketplace",
    hint: (entity) =>
      entity === "websites"
        ? "Clone a published site into your workspace. Publish from Share."
        : "Search pipelines others published. Publish from Share.",
  },
  {
    id: "templates",
    title: "Example templates",
    hint: (entity) =>
      entity === "websites"
        ? "Read-only hosted pages with a backend. Clone to edit."
        : "Read-only until you clone them into your workspace.",
  },
]
