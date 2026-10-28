-- AI : website Embed deployments — origin allowlist + chrome options on shared_links (emb_ ids).
alter table public.shared_links
  add column if not exists allowed_origins text[] not null default '{}'::text[];

alter table public.shared_links
  add column if not exists embed_options jsonb not null default '{}'::jsonb;

comment on column public.shared_links.allowed_origins is
  'Origins allowed to iframe /embed/{id}; empty means not an embed (or framing denied).';

comment on column public.shared_links.embed_options is
  'Embed chrome/delivery prefs: heightPx, theme, hideBranding, postMessageEvents, delivery.';
