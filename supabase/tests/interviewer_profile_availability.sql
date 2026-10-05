-- Rollback-only checks for 20261005073432_interviewer_profile_availability and
-- 20261005073630_interviewer_account_deletion_live_guard.
-- Each block ends with RAISE EXCEPTION 'RESULT: ...', so every change is rolled
-- back; read the result from the error message. The UUIDs are sample accounts
-- in the shared project: replace them when re-running elsewhere.
--   x_*   interviewer with no skills, services or bookings
--   a_*   interviewer with an open future booking
--   cand  active candidate

-- 1. Skills CRUD, canonical dedupe, matching with and without a service
DO $$
DECLARE
  x_ip uuid := 'aa0e2f2a-7ca1-4ec9-8dd4-05207ff17361';
  x_uid uuid := '85d5d684-6299-4a32-b489-83b72d6d25bf';
  other_ip uuid := 'd9179bd4-d4a6-4e22-80f9-8185c657d210';
  cand_uid uuid := 'de2a114c-2006-4487-8f6d-968a2c9b02a9';
  r text := '';
  n int; labels text; other_before int; other_after int; svc uuid; ml_id uuid;
BEGIN
  select count(*) into other_before from interviewer_skills where interviewer_profile_id = other_ip;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', x_uid, 'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', x_uid::text, true);
  set local role authenticated;

  insert into interviewer_skills(interviewer_profile_id, skill) values (x_ip,'python3'),(x_ip,'ml'),(x_ip,'powerbi');
  insert into interviewer_skills(interviewer_profile_id, skill) values (x_ip,'Python 3');
  insert into interviewer_skills(interviewer_profile_id, skill) values (x_ip,'Power BI');
  select count(*), string_agg(skill, ',' order by skill) into n, labels from interviewer_skills where interviewer_profile_id = x_ip;
  r := r || format('T1 skills=%s [%s]; ', n, labels);
  begin
    insert into interviewer_skills(interviewer_profile_id, skill) values (other_ip,'Haskell');
    r := r || 'XINSERT=ALLOWED(BAD); ';
  exception when others then r := r || 'XINSERT=blocked(' || sqlstate || '); ';
  end;

  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', cand_uid, 'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', cand_uid::text, true);
  set local role authenticated;
  select count(*) into n from public.match_interviewers_by_skills(array['Python']) m where to_jsonb(m)::text like '%' || x_ip::text || '%';
  r := r || format('T2 matched_no_service=%s; ', n);

  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', x_uid, 'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', x_uid::text, true);
  set local role authenticated;
  select id into ml_id from interviewer_skills where interviewer_profile_id = x_ip and skill = 'Machine Learning';
  update interviewer_skills set skill = 'deep learning' where id = ml_id;
  select skill into labels from interviewer_skills where id = ml_id;
  r := r || format('T3 edited=%s; ', labels);
  begin
    update interviewer_skills set skill = 'python' where id = ml_id;
    r := r || 'T3dup=ALLOWED(BAD); ';
  exception when others then r := r || 'T3dup=' || sqlerrm || '; ';
  end;
  delete from interviewer_skills where interviewer_profile_id = x_ip and skill = 'Power BI';
  get diagnostics n = row_count;
  r := r || format('T4 deleted_own=%s; ', n);
  delete from interviewer_skills where interviewer_profile_id = other_ip;
  get diagnostics n = row_count;
  r := r || format('T4 deleted_other=%s; ', n);
  insert into interviewer_services(interviewer_profile_id, name, interview_type, duration_min, price_paise, currency, is_active)
  values (x_ip, 'Mock', 'Technical', 60, 50000, 'INR', true) returning id into svc;
  r := r || 'T5 service_created; ';

  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', cand_uid, 'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', cand_uid::text, true);
  set local role authenticated;
  select count(*) into n from public.match_interviewers_by_skills(array['python']) m where to_jsonb(m)::text like '%' || x_ip::text || '%';
  r := r || format('T6 matched_with_service=%s; ', n);

  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', x_uid, 'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', x_uid::text, true);
  set local role authenticated;
  update interviewer_services set price_paise = 75000, name = 'Mock v2' where id = svc;
  select name || ':' || price_paise into labels from interviewer_services where id = svc;
  r := r || format('T7 edited=%s; ', labels);
  delete from interviewer_services where id = svc;
  get diagnostics n = row_count;
  r := r || format('T8 deleted=%s; ', n);
  reset role;
  select count(*) into other_after from interviewer_skills where interviewer_profile_id = other_ip;
  r := r || format('other_skills %s->%s', other_before, other_after);
  RAISE EXCEPTION 'RESULT: %', r;
END $$;
-- Expected: T1 skills=3 [Machine Learning,Power BI,Python]; XINSERT=blocked(42501); T2 matched_no_service=1;
-- T3 edited=deep learning; T3dup=duplicate_skill; T4 deleted_own=1; T4 deleted_other=0; T5 service_created;
-- T6 matched_with_service=1; T7 edited=Mock v2:75000; T8 deleted=1; other_skills unchanged

-- 2. Date range, weekly windows, custom slots, blocked times, slot generation
DO $$
DECLARE
  x_ip uuid := 'aa0e2f2a-7ca1-4ec9-8dd4-05207ff17361';
  x_uid uuid := '85d5d684-6299-4a32-b489-83b72d6d25bf';
  r text := ''; s text;
  n int; svc uuid; d0 date; mn date; mx date; wd int;
BEGIN
  d0 := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', x_uid, 'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', x_uid::text, true);
  set local role authenticated;
  insert into interviewer_services(interviewer_profile_id, name, interview_type, duration_min, price_paise, currency, is_active)
  values (x_ip, 'Mock', 'Technical', 60, 50000, 'INR', true) returning id into svc;
  for wd in 0..6 loop
    insert into interviewer_availability(interviewer_profile_id, weekday, start_time, end_time) values (x_ip, wd, '09:00', '12:00');
    insert into interviewer_availability(interviewer_profile_id, weekday, start_time, end_time) values (x_ip, wd, '14:00', '16:00');
  end loop;
  select count(*), min((starts_at AT TIME ZONE 'Asia/Kolkata')::date), max((starts_at AT TIME ZONE 'Asia/Kolkata')::date) into n, mn, mx
  from public.list_bookable_slots(x_ip, svc, now(), now() + interval '28 days');
  r := r || format('T14 open slots=%s span=%s..%s; ', n, mn - d0, mx - d0);
  begin
    update interviewer_profiles set available_from = d0 + 10, available_until = d0 + 2 where id = x_ip;
    r := r || 'T9 invalid=ALLOWED(BAD); ';
  exception when check_violation then r := r || 'T9 invalid_rejected; ';
  end;
  update interviewer_profiles set available_from = d0 + 2, available_until = d0 + 8 where id = x_ip;
  select count(*), min((starts_at AT TIME ZONE 'Asia/Kolkata')::date), max((starts_at AT TIME ZONE 'Asia/Kolkata')::date) into n, mn, mx
  from public.list_bookable_slots(x_ip, svc, now(), now() + interval '28 days');
  r := r || format('T10/T11 range slots=%s span=%s..%s; ', n, mn - d0, mx - d0);
  begin
    insert into interviewer_custom_slots(interviewer_profile_id, on_date, start_time, end_time) values (x_ip, d0 + 12, '18:00', '20:00');
    r := r || 'T11 custom_outside=ALLOWED(BAD); ';
  exception when others then r := r || 'T11 custom_outside=' || sqlerrm || '; ';
  end;
  insert into interviewer_custom_slots(interviewer_profile_id, on_date, start_time, end_time) values (x_ip, d0 + 5, '18:00', '20:00');
  select count(*) into n from public.list_bookable_slots(x_ip, svc, now(), now() + interval '28 days')
  where (starts_at AT TIME ZONE 'Asia/Kolkata')::date = d0 + 5 and (starts_at AT TIME ZONE 'Asia/Kolkata')::time >= '18:00';
  r := r || format('T13 custom_inside_slots=%s; ', n);
  insert into interviewer_blocked_times(interviewer_profile_id, on_date, all_day) values (x_ip, d0 + 3, true);
  insert into interviewer_blocked_times(interviewer_profile_id, on_date, start_time, end_time, all_day) values (x_ip, d0 + 4, '10:00', '11:00', false);
  select count(*) into n from public.list_bookable_slots(x_ip, svc, now(), now() + interval '28 days') where (starts_at AT TIME ZONE 'Asia/Kolkata')::date = d0 + 3;
  r := r || format('T12 all_day_blocked_slots=%s; ', n);
  select string_agg(to_char(starts_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI'), ',' order by starts_at) into s
  from public.list_bookable_slots(x_ip, svc, now(), now() + interval '28 days') where (starts_at AT TIME ZONE 'Asia/Kolkata')::date = d0 + 4;
  r := r || 'T12 partial_block_day=' || s || '; ';
  RAISE EXCEPTION 'RESULT: %', r;
END $$;
-- Expected: T9 invalid_rejected; T10/T11 range slots=35 span=2..8; T11 custom_outside=custom_slot_outside_range;
-- T13 custom_inside_slots=2; T12 all_day_blocked_slots=0; T12 partial_block_day=09:00,11:00,14:00,15:00

-- 3. Account deletion and cross-user protection (run as postgres / service role)
DO $$
DECLARE
  a_ip uuid := 'ce3eb8bc-ca76-4a02-b0a8-0f6f7c4cf272';
  a_uid uuid := '47a4bc13-195d-4117-9130-289832f1a6be';
  x_ip uuid := 'aa0e2f2a-7ca1-4ec9-8dd4-05207ff17361';
  x_uid uuid := '85d5d684-6299-4a32-b489-83b72d6d25bf';
  cand_uid uuid := 'de2a114c-2006-4487-8f6d-968a2c9b02a9';
  r text := ''; res jsonb;
  bookings_before int; bookings_after int; others_before int; others_after int; cands_before int; cands_after int;
BEGIN
  r := r || format('privs anon=%s auth=%s service=%s; ',
    has_function_privilege('anon','public.delete_interviewer_account_data(uuid)','execute'),
    has_function_privilege('authenticated','public.delete_interviewer_account_data(uuid)','execute'),
    has_function_privilege('service_role','public.delete_interviewer_account_data(uuid)','execute'));
  begin
    perform private.delete_interviewer_account(cand_uid);
    r := r || 'candidate=ALLOWED(BAD); ';
  exception when others then r := r || 'candidate=' || sqlerrm || '; ';
  end;
  select count(*) into bookings_before from bookings;
  select count(*) into others_before from interviewer_skills where interviewer_profile_id not in (a_ip, x_ip);
  select count(*) into cands_before from candidate_skills;
  res := private.delete_interviewer_account(a_uid);
  r := r || 'A=' || res::text || format(' skills=%s avail=%s services_active=%s notif=%s; ',
    (select count(*) from interviewer_skills where interviewer_profile_id=a_ip),
    (select count(*) from interviewer_availability where interviewer_profile_id=a_ip),
    (select count(*) from interviewer_services where interviewer_profile_id=a_ip and is_active),
    (select count(*) from notifications where profile_id=a_uid));
  res := private.delete_interviewer_account(x_uid);
  r := r || 'X=' || res::text || format(' row_exists=%s; ', exists(select 1 from interviewer_profiles where id = x_ip));
  select count(*) into bookings_after from bookings;
  select count(*) into others_after from interviewer_skills where interviewer_profile_id not in (a_ip, x_ip);
  select count(*) into cands_after from candidate_skills;
  r := r || format('bookings %s->%s other_skills %s->%s candidate_skills %s->%s', bookings_before, bookings_after, others_before, others_after, cands_before, cands_after);
  RAISE EXCEPTION 'RESULT: %', r;
END $$;
-- Expected: privs anon=f auth=f service=t; candidate=not_interviewer; A={"hard_delete": false, ...} with owned rows 0;
-- X={"hard_delete": true, ...} row_exists=f; all other counts unchanged
