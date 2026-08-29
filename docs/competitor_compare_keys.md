# Spine vibe eval key

Cloud-only. Paste `OPENROUTER_API_KEY` into the Cursor Cloud environment, then start a new agent that runs `python3 scripts/competitor_compare.py record --prompt-id kyc`. Do not commit keys.

This harness tests **Spine vibe only**. Lovable / Replit / Base44 drivers were removed — those APIs are not available in this cloud environment.

| Platform | Cloud env var | What it calls |
| --- | --- | --- |
| Spine | `OPENROUTER_API_KEY` | `npx tsx scripts/spine-cli.ts agent ask --assistant vibe --apply` |

Placeholder `sk-or-local-…` keys do not count. Same vibe path as the in-app Vibe tab.
