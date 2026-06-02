-- 1) get_my_secret_friend : retourne désormais le nom complet (prenom + nom)
drop function if exists public.get_my_secret_friend();
create function public.get_my_secret_friend()
returns table (
  receiver_id uuid,
  prenom text,
  nom text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  return query
    select sf.receiver_id, p.prenom, coalesce(p.nom, '') as nom
    from public.secret_friends sf
    join public.profiles p on p.id = sf.receiver_id
    where sf.giver_id = auth.uid()
    limit 1;
end;
$$;
grant execute on function public.get_my_secret_friend() to authenticated;

-- 2) Appariement manuel par l'admin (giver → receiver imposé).
--    Remplace l'appariement existant pour ce giver s'il y en avait un.
create or replace function public.admin_set_secret_friend(giver_uid uuid, receiver_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'admin requis';
  end if;
  if giver_uid is null or receiver_uid is null then
    raise exception 'giver et receiver requis';
  end if;
  if giver_uid = receiver_uid then
    raise exception 'giver et receiver doivent être différents';
  end if;

  delete from public.secret_friends where giver_id = giver_uid;
  insert into public.secret_friends (giver_id, receiver_id)
  values (giver_uid, receiver_uid);

  -- Notification push silencieuse au giver pour qu'il voit son nouvel ami
  -- (on laisse côté client le soin d'envoyer la notif s'il le souhaite).
end;
$$;
grant execute on function public.admin_set_secret_friend(uuid, uuid) to authenticated;

-- 3) RPC pour visualiser tous les appariements (admin) — utile pour la gestion manuelle.
create or replace function public.admin_list_secret_friends()
returns table (
  giver_id uuid,
  giver_prenom text,
  giver_nom text,
  receiver_id uuid,
  receiver_prenom text,
  receiver_nom text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'admin requis';
  end if;

  return query
    select
      sf.giver_id,
      gp.prenom as giver_prenom,
      coalesce(gp.nom, '') as giver_nom,
      sf.receiver_id,
      rp.prenom as receiver_prenom,
      coalesce(rp.nom, '') as receiver_nom
    from public.secret_friends sf
    join public.profiles gp on gp.id = sf.giver_id
    join public.profiles rp on rp.id = sf.receiver_id
    order by gp.prenom asc;
end;
$$;
grant execute on function public.admin_list_secret_friends() to authenticated;
