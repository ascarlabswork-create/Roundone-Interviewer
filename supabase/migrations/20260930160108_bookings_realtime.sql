-- Publish booking status changes to Supabase Realtime. Subscribers still pass
-- through the bookings_select RLS policy, so each party only receives its own rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end
$$;
