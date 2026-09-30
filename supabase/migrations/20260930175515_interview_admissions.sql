create table if not exists public.interview_admissions (
  session_id uuid primary key references public.interview_sessions(id) on delete cascade,
  status text not null check (status in ('waiting', 'admitted', 'denied')),
  requested_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.interview_admissions enable row level security;
revoke all on public.interview_admissions from public, anon, authenticated;
grant select on public.interview_admissions to authenticated;

drop policy if exists interview_admissions_select on public.interview_admissions;
create policy interview_admissions_select on public.interview_admissions
  for select to authenticated
  using (exists (
    select 1 from public.interview_sessions s
    where s.id = interview_admissions.session_id and private.can_read_booking(s.booking_id)
  ));

-- Candidate asks to be let into the call. A previous admission is kept so a
-- dropped candidate can rejoin without asking again.
create or replace function public.request_interview_admission(p_session_id uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  v_access jsonb;
  v_status text;
begin
  if p_session_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  v_access := private.interview_call_context(null, p_session_id);
  if v_access->>'role' is distinct from 'candidate' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  insert into public.interview_admissions as a (session_id, status, requested_at, updated_at)
  values (p_session_id, 'waiting', now(), now())
  on conflict (session_id) do update
    set status = case when a.status = 'admitted' then 'admitted' else 'waiting' end,
        requested_at = now(),
        updated_at = now()
  returning a.status into v_status;

  if v_status = 'waiting' then
    insert into public.session_events (session_id, event_type, actor_profile_id, payload)
    values (p_session_id, 'admission_requested', auth.uid(), jsonb_build_object('role', 'candidate'));
  end if;
  return v_status;
end;
$$;

-- Interviewer admits or declines the candidate for this session.
create or replace function public.decide_interview_admission(p_session_id uuid, p_admit boolean)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
  v_access jsonb;
  v_status text := case when p_admit then 'admitted' else 'denied' end;
begin
  if p_session_id is null or p_admit is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  v_access := private.interview_call_context(null, p_session_id);
  if v_access->>'role' is distinct from 'interviewer' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  insert into public.interview_admissions as a (session_id, status, decided_at, decided_by, updated_at)
  values (p_session_id, v_status, now(), auth.uid(), now())
  on conflict (session_id) do update
    set status = excluded.status,
        decided_at = now(),
        decided_by = auth.uid(),
        updated_at = now();

  insert into public.session_events (session_id, event_type, actor_profile_id, payload)
  values (
    p_session_id,
    case when p_admit then 'candidate_admitted' else 'candidate_denied' end,
    auth.uid(),
    jsonb_build_object('role', 'interviewer')
  );
  return v_status;
end;
$$;

revoke all on function public.request_interview_admission(uuid) from public, anon;
revoke all on function public.decide_interview_admission(uuid, boolean) from public, anon;
grant execute on function public.request_interview_admission(uuid) to authenticated, service_role;
grant execute on function public.decide_interview_admission(uuid, boolean) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'interview_admissions'
  ) then
    alter publication supabase_realtime add table public.interview_admissions;
  end if;
end
$$;
