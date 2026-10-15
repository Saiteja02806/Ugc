-- Run through the database management connection, then pass the returned
-- fixture_user to check-carousel-parallel-ownership.mjs. No delivery is queued.
begin;
do $$
declare
  fixture_user text := 'carousel-capacity-canary-' || gen_random_uuid()::text;
  profile_id uuid := gen_random_uuid();
  plan_id uuid := gen_random_uuid();
  batch_id uuid; generation_batch uuid; reservation_id uuid;
  assignment_id uuid; item_id uuid; generation_id uuid;
  batch_number integer; slot_number integer;
begin
  perform set_config('ugc.carousel_canary_user', fixture_user, true);
  insert into public.business_profiles(id,user_id,project_id,intake_type,context_json,content_hash)
  values(profile_id,fixture_user,'carousel-capacity-canary','manual','{}',fixture_user);
  insert into public.carousel_content_plans(id,user_id,project_id,business_profile_id,business_profile_version,
    period_start_date,period_end_date,timezone,business_description,planner_prompt_version)
  values(plan_id,fixture_user,'carousel-capacity-canary',profile_id,1,'2099-01-01','2099-01-30','UTC',
    'Synthetic database concurrency verification only.','capacity-canary');
  for batch_number in 0..10 loop
    batch_id := gen_random_uuid(); generation_batch := gen_random_uuid(); reservation_id := gen_random_uuid();
    insert into public.carousel_content_plan_reservations(id,plan_id,user_id,reservation_key,requested_count,expires_at)
    values(reservation_id,plan_id,fixture_user,batch_id::text,5,now()+interval '1 hour');
    insert into public.carousel_experiment_batches(id,business_profile_id,business_profile_version,generation_batch_id,
      batch_sequence,structure_id,structure_batch_sequence,requested_structure_id,requested_structure_version,
      requested_structure_batch_sequence,cycle_number,cycle_batch_position)
    values(batch_id,profile_id,1,generation_batch,batch_number,'structure_1',batch_number,'structure_1',1,
      batch_number,batch_number/3+1,batch_number%3);
    for slot_number in 0..4 loop
      assignment_id := gen_random_uuid(); item_id := gen_random_uuid(); generation_id := gen_random_uuid();
      insert into public.carousel_content_plan_items(id,plan_id,user_id,sequence_index,day_number,day_slot_index,
        creative_seed,emotion,seed_fingerprint,status,reservation_token,reservation_key,reserved_at,reservation_expires_at)
      values(item_id,plan_id,fixture_user,batch_number*5+slot_number+1,1,batch_number*5+slot_number+1,
        'Synthetic verification '||batch_number||'/'||slot_number,'clarity',
        repeat(md5(generation_id::text),2),'reserved',reservation_id,batch_id::text,now(),now()+interval '1 hour');
      insert into public.carousel_experiment_assignments(id,experiment_batch_id,slot_index,assigned_format_id,
        rotation_candidate_format_id,hook_family_id,hook_selection_mode,hook_selection_multiplier,format_version)
      values(assignment_id,batch_id,slot_number,'how_to','how_to','curiosity','controlled_rotation',1,1);
      insert into public.carousel_generations(id,user_id,project_id,business_profile_id,business_profile_version,
        generation_batch_id,candidate_index,candidate_count,carousel_experiment_batch_id,carousel_experiment_assignment_id,
        content_plan_id,content_plan_item_id,content_plan_reservation_id,generation_source)
      values(generation_id,fixture_user,'carousel-capacity-canary',profile_id,1,generation_batch,batch_number*5+slot_number,
        5,batch_id,assignment_id,plan_id,item_id,reservation_id,'auto_generated');
      update public.carousel_experiment_assignments set carousel_generation_id=generation_id where id=assignment_id;
    end loop;
  end loop;
end $$;
select current_setting('ugc.carousel_canary_user') as fixture_user;
commit;
