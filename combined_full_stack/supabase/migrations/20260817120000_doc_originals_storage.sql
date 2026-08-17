-- AI : private original PDF/image bytes for GET /api/docs/:id/file (Vercel /tmp is ephemeral).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'doc-originals',
  'doc-originals',
  false,
  26214400,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists doc_originals_select on storage.objects;
create policy doc_originals_select on storage.objects
  for select using (
    bucket_id = 'doc-originals'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or exists (
        select 1
        from public.projects p
        inner join public.team_members tm
          on tm.team_id = p.team_id and tm.user_id = auth.uid()
        where p.user_id::text = split_part(name, '/', 1)
          and p.team_id is not null
      )
    )
  );

drop policy if exists doc_originals_insert on storage.objects;
create policy doc_originals_insert on storage.objects
  for insert with check (
    bucket_id = 'doc-originals'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists doc_originals_update on storage.objects;
create policy doc_originals_update on storage.objects
  for update using (
    bucket_id = 'doc-originals'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'doc-originals'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists doc_originals_delete on storage.objects;
create policy doc_originals_delete on storage.objects
  for delete using (
    bucket_id = 'doc-originals'
    and split_part(name, '/', 1) = auth.uid()::text
  );
