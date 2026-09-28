create or replace function public.match_all_candidates_by_skills(
  p_page integer default 1,
  p_page_size integer default 20,
  p_search text default null,
  p_sort text default 'match'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_interviewer_id uuid;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 50);
  v_sort text := case when p_sort = 'name' then 'name' else 'match' end;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_like text;
  v_search_key text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  v_interviewer_id := private.current_interviewer_profile_id();
  if v_interviewer_id is null then
    raise exception 'not_an_interviewer' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.is_active) then
    raise exception 'account_inactive' using errcode = '42501';
  end if;

  if v_search is not null then
    v_search := left(v_search, 100);
    v_search_like := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_search_key := private.canonical_skill_key(v_search);
  end if;

  with interviewer_raw as (
    select
      private.canonical_skill_key(sk.skill) as skill_key,
      private.canonical_skill_label(sk.skill) as label
    from public.interviewer_skills sk
    where sk.interviewer_profile_id = v_interviewer_id
  ),
  interviewer_set as (
    select distinct on (skill_key) skill_key, label
    from interviewer_raw
    where skill_key is not null
    order by skill_key, label
  ),
  interviewer_count as (
    select count(*)::integer as n from interviewer_set
  ),
  eligible as (
    select
      cp.id as candidate_profile_id,
      p.full_name,
      cp.target_role,
      cp.candidate_level
    from public.candidate_profiles cp
    join public.profiles p on p.id = cp.profile_id
    where p.is_active
      and cp.profile_id <> v_uid
  ),
  candidate_raw as (
    select cs.candidate_profile_id, cs.skill, 1 as source_rank
    from public.candidate_skills cs
    join eligible e on e.candidate_profile_id = cs.candidate_profile_id
    union all
    select rs.candidate_profile_id, rs.skill, 2 as source_rank
    from public.candidate_resume_skills rs
    join eligible e on e.candidate_profile_id = rs.candidate_profile_id
    where rs.accepted
  ),
  candidate_set as (
    select distinct on (candidate_profile_id, skill_key)
      candidate_profile_id, skill_key, label
    from (
      select
        r.candidate_profile_id,
        private.canonical_skill_key(r.skill) as skill_key,
        private.canonical_skill_label(r.skill) as label,
        r.source_rank
      from candidate_raw r
    ) keyed
    where skill_key is not null
    order by candidate_profile_id, skill_key, source_rank, label
  ),
  candidate_agg as (
    select
      c.candidate_profile_id,
      array_agg(c.label order by lower(c.label)) as skills,
      array_agg(i.label order by lower(i.label)) filter (where i.skill_key is not null) as matched_skills,
      array_agg(c.skill_key) filter (where i.skill_key is not null) as matched_keys,
      array_agg(c.label order by lower(c.label)) filter (where i.skill_key is null) as extra_candidate_skills,
      array_agg(c.skill_key) as skill_keys
    from candidate_set c
    left join interviewer_set i on i.skill_key = c.skill_key
    group by c.candidate_profile_id
  ),
  scored as (
    select
      e.candidate_profile_id,
      e.full_name,
      e.target_role,
      e.candidate_level,
      coalesce(a.skills, array[]::text[]) as skills,
      coalesce(a.matched_skills, array[]::text[]) as matched_skills,
      coalesce((
        select array_agg(i.label order by lower(i.label))
        from interviewer_set i
        where not (i.skill_key = any(coalesce(a.matched_keys, array[]::text[])))
      ), array[]::text[]) as missing_interviewer_skills,
      coalesce(a.extra_candidate_skills, array[]::text[]) as extra_candidate_skills,
      coalesce(a.skill_keys, array[]::text[]) as skill_keys,
      case
        when ic.n = 0 then 0::numeric
        else coalesce(cardinality(a.matched_keys), 0)::numeric / ic.n::numeric
      end as skill_ratio
    from eligible e
    cross join interviewer_count ic
    left join candidate_agg a on a.candidate_profile_id = e.candidate_profile_id
  ),
  filtered as (
    select s.*
    from scored s
    where v_search is null
      or s.full_name ilike v_search_like
      or coalesce(s.target_role, '') ilike v_search_like
      or exists (select 1 from unnest(s.skills) as sk(label) where sk.label ilike v_search_like)
      or (v_search_key is not null and v_search_key = any(s.skill_keys))
  ),
  total as (
    select count(*)::integer as n from filtered
  ),
  page_rows as (
    select f.*
    from filtered f
    order by
      case when v_sort = 'match' then f.skill_ratio end desc nulls last,
      case when v_sort = 'name' then lower(f.full_name) end asc nulls last,
      f.candidate_profile_id asc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  )
  select jsonb_build_object(
    'page', v_page,
    'page_size', v_page_size,
    'sort', v_sort,
    'total_count', (select n from total),
    'interviewer_skills', coalesce((select jsonb_agg(i.label order by lower(i.label)) from interviewer_set i), '[]'::jsonb),
    'candidates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'candidate_profile_id', pr.candidate_profile_id,
          'full_name', pr.full_name,
          'target_role', pr.target_role,
          'candidate_level', pr.candidate_level,
          'skills', to_jsonb(pr.skills),
          'matched_skills', to_jsonb(pr.matched_skills),
          'missing_interviewer_skills', to_jsonb(pr.missing_interviewer_skills),
          'extra_candidate_skills', to_jsonb(pr.extra_candidate_skills),
          'skill_ratio', round(pr.skill_ratio, 4),
          'skill_percent', round(pr.skill_ratio * 1000) / 10,
          'booked_sessions_count', (
            select count(*)::integer
            from public.bookings b
            where b.interviewer_profile_id = v_interviewer_id
              and b.candidate_profile_id = pr.candidate_profile_id
          )
        )
        order by
          case when v_sort = 'match' then pr.skill_ratio end desc nulls last,
          case when v_sort = 'name' then lower(pr.full_name) end asc nulls last,
          pr.candidate_profile_id asc
      )
      from page_rows pr
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.match_all_candidates_by_skills(integer, integer, text, text) from public;
revoke all on function public.match_all_candidates_by_skills(integer, integer, text, text) from anon;
grant execute on function public.match_all_candidates_by_skills(integer, integer, text, text) to authenticated;
grant execute on function public.match_all_candidates_by_skills(integer, integer, text, text) to postgres;
grant execute on function public.match_all_candidates_by_skills(integer, integer, text, text) to service_role;
