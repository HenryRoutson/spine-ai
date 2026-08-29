# API keys for Lovable / Replit / Base44 comparison

Cloud-only. Paste keys into the Cursor Cloud environment, then start a new agent that runs `python3 scripts/competitor_compare.py record --prompt-id kyc`. Do not commit keys.

Environment secrets: [ef508992-a215-11f1-b532-320a589b8025](https://cursor.com/dashboard/cloud-agents/environments/e/ef508992-a215-11f1-b532-320a589b8025) → Secrets. Names must match the table below.

## Are those three links the right docs?

| Link you sent | What it actually is | Used by this harness? |
| --- | --- | --- |
| [Lovable API](https://docs.lovable.dev/integrations/lovable-api) | Official “Lovable API” page. The shipped product is **Build with URL** (a shareable `https://lovable.dev/?autosubmit=true#prompt=…` link), plus a pointer to the MCP server. It does **not** mint a pasteable API key. | Yes for `urls` / start links. Not used as a key. Technical sibling: [Build with URL](https://docs.lovable.dev/integrations/build-with-url). |
| [Base44 Using integrations](https://docs.base44.com/Integrations/Using-integrations) | How to connect **other** products (OpenAI, Slack, Notion) **into** a Base44 app. The “Getting your API keys” section is those third-party keys. The FAQ **“How do I regenerate or update my API key?”** is the Base44 **account** key — that part is relevant. | Account-key FAQ only. Prefer the dedicated page below. |
| [Base44 CLI overview](https://docs.base44.com/developers/references/cli/get-started/overview) | Local `npx base44` for scaffolding, `login`, deploy. Not required for cloud compare. | No. `base44 create` is a template scaffold, not “send this prompt to the vibe agent.” |

### What the harness actually calls

| Platform | Cloud env var | Endpoint | Official auth docs |
| --- | --- | --- | --- |
| Lovable | `LOVABLE_API_KEY` | `POST https://api.lovable.dev/v1/projects` with header `Lovable-API-Key` (same as [`@lovable.dev/sdk`](https://www.npmjs.com/package/@lovable.dev/sdk)) | Official product API is [Build with URL](https://docs.lovable.dev/integrations/build-with-url). Official agent API is [MCP](https://docs.lovable.dev/integrations/lovable-mcp-server) (**OAuth only** — “API key authentication is not currently available”). A `lov_…` REST key is **not** documented on the Lovable API page. |
| Replit | `REPLIT_MCP_ACCESS_TOKEN` | MCP `https://replit-mcp.com/server/mcp` → `create_app_from_prompt` | [Replit MCP Server](https://docs.replit.com/platforms/mcp-server) — **OAuth only**. Docs say do not add a bearer token. There is no official static Agent API key. |
| Base44 | `BASE44_API_KEY` only | MCP `https://app.base44.com/mcp` → `create_base44_app` | Copyable account key: [Managing your API key](https://docs.base44.com/documentation/account-and-billing/managing-your-account#managing-your-api-key). CLI also accepts `BASE44_API_KEY` (`b44k_…`) per [Base44 CLI](https://docs.base44.com/developers/skills/base44-cli). Official MCP is [OAuth](https://docs.base44.com/developers/backend/overview/mcp-server) (Builder plan+). |
| Spine | `OPENROUTER_API_KEY` | `npx tsx scripts/spine-cli.ts agent ask --assistant vibe --apply` | Same vibe path as the in-app Vibe tab. Placeholder `sk-or-local-…` keys do not count. |

Only **Base44** has a documented “copy this key, paste it into a secret” flow. Lovable and Replit’s official programmatic paths are URL + OAuth, not a long-lived key.

---

## Base44 — documented account API key (use this)

Source: [Changing your account settings → Managing your API key](https://docs.base44.com/documentation/account-and-billing/managing-your-account#managing-your-api-key). Same clicks in the FAQ on [Using integrations](https://docs.base44.com/Integrations/Using-integrations).

1. Open [app.base44.com](https://app.base44.com/) and sign in.
2. Click your **workspace name** at the bottom left.
3. Click **Settings**.
4. Click **Preferences**.
5. Find **API Key**. Copy it, or click **Regenerate** then copy the new value.
6. In the Cursor environment, add secret `BASE44_API_KEY` with that value. The harness does not read `BASE44_ACCESS_TOKEN`, CLI auth files, or browser cookies.

Notes:

- Regenerating invalidates the old key everywhere. Update every place you pasted it.
- Treat it like a password. Do not put it in git, chat, or `compare.html`.
- Optional Enterprise/Business **workspace** keys (scopes for audit/monitoring/deploy) are created at Settings → **Secrets** → **+ Create API Key**. That is [Managing workspace secrets](https://docs.base44.com/Enterprise/workspace-secrets). Those keys are for admin APIs, not the vibe-coding chat. Prefer the Preferences account key for this compare.
- Official MCP (`create_base44_app`) is OAuth and needs a [Builder plan or higher](https://docs.base44.com/developers/backend/overview/mcp-server). The harness sends the Preferences key as a Bearer token to `https://app.base44.com/mcp`. If Base44 rejects it, the official fallback is OAuth — there is no second documented static key for MCP.

Skip the CLI overview unless you already use `npx base44` on a machine. You do not need `base44 login` or a local install for cloud compare.

---

## Lovable — official API is a URL, not a key

### What the Lovable API page is

[Lovable API](https://docs.lovable.dev/integrations/lovable-api) describes **Build with URL**:

- Base: `https://lovable.dev/?autosubmit=true#`
- Prompt goes in the **hash**, not the query string: `#prompt=…` (URL-encoded, max 50,000 characters).
- Optional `#images=` / `#html=` public reference URLs.
- Signed-in user: pick a workspace, build starts.
- Signed-out user: sign in first; the prompt is kept.

Full parameter table: [Build with URL](https://docs.lovable.dev/integrations/build-with-url).

`python3 scripts/competitor_compare.py urls --prompt-id kyc` prints this link. That is the official Lovable API. It still needs **your Lovable session in a browser**. It is not a secret you can drop into a Cloud Agent and have it build unattended.

### Official agent API (OAuth, no key)

[Lovable MCP server](https://docs.lovable.dev/integrations/lovable-mcp-server):

- URL: `https://mcp.lovable.dev`
- Auth: OAuth in the MCP client. FAQ: **“Can I connect with an API key? API key authentication is not currently available.”**
- `create_project` takes `initial_message` (the build prompt).
- Uses real credits. All plans; Enterprise must enable **Third-party MCP clients** under Settings → Security → Privacy & security.
- In-product: Settings → **Build & deploy** → **MCP server**.

Do not confuse this with the project secret also named `LOVABLE_API_KEY`. That is an auto-generated **per-app** key for Lovable Cloud / built-in AI inside a project ([Secrets](https://docs.lovable.dev/features/secrets), [Integration security](https://docs.lovable.dev/integrations/security)). Rotating it does not let an external script create new Lovable apps.

### Optional REST key (`LOVABLE_API_KEY` in *this* repo)

If the harness sees `LOVABLE_API_KEY`, it calls `https://api.lovable.dev` the same way [`@lovable.dev/sdk`](https://www.npmjs.com/package/@lovable.dev/sdk) does (`Lovable-API-Key` header, `lov_…` keys). That is **not** documented on the Lovable API page you sent. Official MCP docs currently say API keys are unavailable.

If Lovable later shows a workspace **API key** / **Developer** panel that issues `lov_…`, paste that value into the Cloud environment as `LOVABLE_API_KEY`. Optional: `LOVABLE_WORKSPACE_ID` to pin a workspace; otherwise the harness uses the first workspace from `GET /v1/workspaces`.

Until that exists, cloud-unattended Lovable compare is blocked by official docs.

---

## Replit — official Agent API is OAuth, not a key

Source: [Replit MCP Server](https://docs.replit.com/platforms/mcp-server), product page [replit.com/mcp](https://replit.com/mcp).

| | |
| --- | --- |
| URL | `https://replit-mcp.com/server/mcp` |
| Transport | Streamable HTTP |
| Auth | OAuth (protected-resource discovery) |
| Create tool | `create_app_from_prompt` (`appDescription`, `app_stack`) |

Setup in an MCP client (Cursor, Claude, Codex): add that URL, **do not** add a bearer token or custom headers, then click Authenticate and pick a workspace.

There is no documented “copy an Agent API key” page. Enterprise [Admin API](https://docs.replit.com/teams/admin-api) `rpl_…` keys are for workspace admin analytics, not `create_app_from_prompt`.

The harness env var `REPLIT_MCP_ACCESS_TOKEN` is an unofficial Bearer to the same MCP URL. Official docs do not tell you how to mint that token. Cloud-unattended Replit compare is blocked unless Replit later ships a static token.

---

## Cursor Cloud secrets (no local machine)

1. Open [ef508992-a215-11f1-b532-320a589b8025](https://cursor.com/dashboard/cloud-agents/environments/e/ef508992-a215-11f1-b532-320a589b8025).
2. Add secrets (values only in the dashboard, never in the repo):

   | Secret | Required for cloud `record` |
   | --- | --- |
   | `BASE44_API_KEY` | Yes — only Base44 secret the harness reads |
   | `OPENROUTER_API_KEY` | Yes, for Spine vibe (`--platforms base44,spine`) |
   | `LOVABLE_API_KEY` | Only if you have a `lov_…` REST key |
   | `LOVABLE_WORKSPACE_ID` | Optional |
   | `REPLIT_MCP_ACCESS_TOKEN` | Only if you have a Replit MCP access token |
   | `REPLIT_APP_STACK` | Optional, default `react_website` |

3. Start a **new** Cloud Agent (existing pods do not pick up new secrets).
4. Ask it to run:

   ```bash
   python3 scripts/competitor_compare.py check
   python3 scripts/competitor_compare.py record --platforms base44,spine --prompt-id kyc
   ```

`check` prints `READY` / `NEED` per platform without printing full secrets. Platforms without a secret are skipped; the other columns still write to `competitor_runs/<timestamp>/compare.html`.

Do not use `login` / Playwright / `live` for cloud tests. Those need a headed browser and your session.

---

## Credits and side effects

Each successful `record` creates a **real** project on that account and spends that product’s credits. Use a throwaway workspace if you can. Name prefix is `spine-compare-…`.
