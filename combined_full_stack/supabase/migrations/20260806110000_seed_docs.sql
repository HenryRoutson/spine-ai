-- AI : platform bundled example docs — one row per seed filename, not duplicated per user.
-- AI : templates stay in seeds/*.json; users clone via POST /api/projects.

create table if not exists public.seed_docs (
  id text not null primary key,
  name text not null unique,
  type text not null,
  label text not null default '',
  size_kb int not null default 1,
  uploaded_at bigint not null,
  preview text not null default '',
  content text not null default ''
);

create index if not exists seed_docs_name_idx on public.seed_docs (name);

alter table public.seed_docs enable row level security;

drop policy if exists seed_docs_select on public.seed_docs;
create policy seed_docs_select on public.seed_docs
  for select using (auth.uid() is not null);
