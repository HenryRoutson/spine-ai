-- AI : anon key must not SELECT all published links — public access is server-side by id only (service role).
drop policy if exists shared_links_public_read on public.shared_links;
