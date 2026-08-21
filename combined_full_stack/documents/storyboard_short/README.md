# Storyboard short

720p Higgsfield example: idea → character/location extraction → reference stills → image-to-video → in-app storyboard (title + lower-third overlay). Not a vendor connector.

1. **Write bible** — one LLM call locks character (`face_lock`, `wardrobe`) and location, plus a motion prompt.
2. **Hero request (fork)** — parallel Soul image jobs (3:4 portrait, 16:9 hero still with the character in frame). Poll `status_url`, ingest `images.0.url` as `ImageStill`, then assemble `image_url` + `motion_prompt` into the DoP body.
3. **Hero clip** — DoP image-to-video, ingest `video.url` as `VideoClip`.
4. **Play** — stills + clip + overlay copy. Open the **play** tab on the output; do not rely on the download link.

Set **Settings → Secrets → `HIGGSFIELD_API_KEY`** to `Key KEY_ID:KEY_SECRET` (or `KEY_ID:KEY_SECRET`). Generate URLs default to Higgsfield Soul / DoP at 720p; override with `HIGGSFIELD_IMAGE_URL` / `HIGGSFIELD_GENERATE_URL` only if you need a different endpoint.

Spine does not ship `ModuleKind.Higgsfield`. OpenCut is not a headless render API yet — motion graphics for this seed are the in-app title / lower-third overlay on the stored clip.
