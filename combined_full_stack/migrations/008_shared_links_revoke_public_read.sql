-- AI : anon key must not SELECT all published links — public access is server-side by id only (service role).
-- AI : TODO security — duplicate of supabase/migrations/20260628140000; only supabase/migrations/ is auto-applied.
drop policy if exists shared_links_public_read on public.shared_links;
