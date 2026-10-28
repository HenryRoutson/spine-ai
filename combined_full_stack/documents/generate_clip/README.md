# Generate clip

This pipeline is a **visualization / validation / pipeline** example, not a Higgsfield product integration.

1. **Validate** a `ClipPrompt` JSON document (typed spine).
2. **Pipeline** — webhook POSTs that object (`raw` body) to the generate URL (default `https://platform.higgsfield.ai/higgsfield-ai/dop/standard` when `HIGGSFIELD_GENERATE_URL` is unset), polls `status_url`, then fetches `video.url` into Documents.
3. **Visualize** the stored blob as a `VideoClip` (`doc_id` + filename + mime) on the **play** tab. The JSON tab is still the typed envelope.

Set **Settings → Secrets → `HIGGSFIELD_API_KEY`** to the full `Authorization` value, e.g. `Key KEY_ID:KEY_SECRET` (or just `KEY_ID:KEY_SECRET`). Optional: `HIGGSFIELD_GENERATE_URL` if you are not using the default DoP endpoint.

Spine does not ship a Higgsfield connector, node catalog, or `ModuleKind.Higgsfield`. Change the URL, JSON paths, or prompt schema to talk to a different generate API.
