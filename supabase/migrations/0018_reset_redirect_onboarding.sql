-- Garantit que le reset admin redirige le user vers l'onboarding en live :
--   1) RPC admin_reset_conversations met onboarding_completed_at à null
--   2) Realtime publication contient profiles + question_deliveries
--   3) Replica identity FULL pour que la mise à jour soit visible côté client

-- 1) RPC : reset complet
create or replace function public.admin_reset_conversations(target_user_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_uid uuid := auth.uid();
  v_deleted int;
  v_target_ids uuid[];
begin
  if v_admin_uid is null then
    raise exception 'not authenticated';
  end if;
  if not coalesce((select is_admin from public.profiles where id = v_admin_uid), false) then
    raise exception 'admin requis';
  end if;

  if target_user_ids is null or array_length(target_user_ids, 1) is null then
    select array_agg(distinct user_id) into v_target_ids from public.question_deliveries;
    delete from public.question_deliveries;
    get diagnostics v_deleted = row_count;
  else
    v_target_ids := target_user_ids;
    delete from public.question_deliveries where user_id = any(target_user_ids);
    get diagnostics v_deleted = row_count;
  end if;

  if v_target_ids is not null and array_length(v_target_ids, 1) is not null then
    -- Forcer onboarding à refaire
    update public.profiles
      set onboarding_completed_at = null
      where id = any(v_target_ids);
    -- Jauges remises à zéro
    perform public.recompute_gauges(uid) from unnest(v_target_ids) as uid;
  end if;

  return v_deleted;
end;
$$;

grant execute on function public.admin_reset_conversations(uuid[]) to authenticated;

-- 2) Realtime publication (idempotent)
do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.question_deliveries;
  exception when duplicate_object then null;
  end;
end $$;

-- 3) Replica identity FULL : nécessaire pour que les UPDATE diffusent toutes les colonnes
--    (sinon le client reçoit l'event mais peut louper certains champs)
alter table public.profiles replica identity full;
alter table public.question_deliveries replica identity full;
