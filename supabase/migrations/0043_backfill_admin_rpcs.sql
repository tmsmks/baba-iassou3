-- Rapatriement des RPC qui existaient uniquement en base (créées hors migration)
-- afin que le dépôt redevienne la source de vérité et que la base soit
-- reconstructible. Définitions extraites du dump du projet lié (schéma public).
-- `create or replace` → idempotent : rejouer cette migration ne change pas le
-- comportement existant, elle ne fait qu'enregistrer ces fonctions dans Git.

-- 1) admin_delete_user : suppression définitive d'un compte (cascade via auth.users)
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_uid uuid := auth.uid();
begin
  if v_admin_uid is null then
    raise exception 'not authenticated';
  end if;
  if not coalesce((select is_admin from public.profiles where id = v_admin_uid), false) then
    raise exception 'admin requis';
  end if;
  if target_user_id = v_admin_uid then
    raise exception 'tu ne peux pas te supprimer toi-même';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 2) admin_set_moderator : promeut / rétrograde un modérateur
create or replace function public.admin_set_moderator(target_user_id uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_uid uuid := auth.uid();
begin
  if v_admin_uid is null then
    raise exception 'not authenticated';
  end if;
  if not coalesce((select is_admin from public.profiles where id = v_admin_uid), false) then
    raise exception 'admin requis';
  end if;
  update public.profiles set is_moderator = value where id = target_user_id;
end;
$$;

grant execute on function public.admin_set_moderator(uuid, boolean) to authenticated;

-- 3) admin_stats : agrégats pour le tableau de bord admin
create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_uid uuid := auth.uid();
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  v_result jsonb;
  v_gauges jsonb;
  v_sermons jsonb;
begin
  if v_admin_uid is null then
    raise exception 'not authenticated';
  end if;
  if not coalesce((select is_admin from public.profiles where id = v_admin_uid), false) then
    raise exception 'admin requis';
  end if;

  -- Distribution moyenne des jauges (sur tous les participants)
  select jsonb_build_object(
    'c', round(coalesce(avg(c_score), 0)::numeric, 2),
    'h', round(coalesce(avg(h_score), 0)::numeric, 2),
    'o', round(coalesce(avg(o_score), 0)::numeric, 2),
    'i', round(coalesce(avg(i_score), 0)::numeric, 2),
    'x', round(coalesce(avg(x_score), 0)::numeric, 2)
  ) into v_gauges
  from public.gauges g
  join public.profiles p on p.id = g.user_id
  where p.is_admin = false;

  -- Stats par sermon
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'intervenant', s.intervenant,
    'theme', s.theme,
    'debut_at', s.debut_at,
    'manual_open', s.manual_open,
    'questions_count', coalesce((select count(*) from public.faq_questions q where q.sermon_id = s.id), 0),
    'answered_count', coalesce((select count(*) from public.faq_questions q where q.sermon_id = s.id and q.is_answered), 0),
    'total_likes', coalesce((select count(*) from public.faq_likes l
                              join public.faq_questions q on q.id = l.question_id
                              where q.sermon_id = s.id), 0)
  ) order by s.debut_at), '[]'::jsonb) into v_sermons
  from public.sermons s;

  select jsonb_build_object(
    'total_participants', (select count(*) from public.profiles where is_admin = false),
    'onboarded_participants', (select count(*) from public.profiles where is_admin = false and onboarding_completed_at is not null),
    'pending_invites', (select count(*) from public.profiles where is_admin = false and onboarding_completed_at is null),
    'responses_today', (select count(*) from public.responses where created_at >= v_today_start),
    'responses_total', (select count(*) from public.responses),
    'chat_questions_sent', (select count(*) from public.question_deliveries),
    'gauges', v_gauges,
    'sermons', v_sermons,
    'photos_count', (select count(*) from public.photos),
    'secret_messages_count', (select count(*) from public.secret_messages),
    'secret_friends_assigned', (select count(*) from public.secret_friends),
    'updated_at', now()
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_stats() to authenticated;

-- 4) admin_toggle_secret_reveal : ouvre / ferme le reveal des amis secrets
create or replace function public.admin_toggle_secret_reveal(value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_uid uuid := auth.uid();
begin
  if v_admin_uid is null then
    raise exception 'not authenticated';
  end if;
  if not coalesce((select is_admin from public.profiles where id = v_admin_uid), false) then
    raise exception 'admin requis';
  end if;
  update public.conference_state
    set secret_reveal_at = case when value then now() else null end,
        updated_at = now()
    where id = true;
end;
$$;

grant execute on function public.admin_toggle_secret_reveal(boolean) to authenticated;

-- 5) get_secret_reveal : renvoie au participant qui lui offre / à qui il offre
create or replace function public.get_secret_reveal()
returns table(giver_prenom text, giver_nom text, receiver_prenom text, receiver_nom text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_revealed boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select (secret_reveal_at is not null) into v_revealed
    from public.conference_state where id = true;
  if not coalesce(v_revealed, false) then
    raise exception 'reveal pas encore lancé';
  end if;

  return query
  select g.prenom, g.nom, r.prenom, r.nom
  from public.profiles me
  left join public.secret_friends sf_in on sf_in.receiver_id = me.id
  left join public.profiles g on g.id = sf_in.giver_id
  left join public.secret_friends sf_out on sf_out.giver_id = me.id
  left join public.profiles r on r.id = sf_out.receiver_id
  where me.id = v_uid;
end;
$$;

grant execute on function public.get_secret_reveal() to authenticated;

-- 6) mark_secret_message_read : marque un message secret reçu comme lu
create or replace function public.mark_secret_message_read(message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.secret_messages
    set read_at = coalesce(read_at, now())
    where id = message_id and receiver_id = v_uid;
end;
$$;

grant execute on function public.mark_secret_message_read(uuid) to authenticated;
