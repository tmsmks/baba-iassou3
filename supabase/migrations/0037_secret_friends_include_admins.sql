-- Amis secrets : inclure les admins dans le tirage (Sattolo sur TOUS les profils onboardés).

create or replace function public.admin_assign_secret_friends()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_uid uuid := auth.uid();
  v_ids uuid[];
  v_n integer;
  v_j integer;
  v_tmp uuid;
begin
  if v_admin_uid is null then
    raise exception 'not authenticated';
  end if;
  if not coalesce((select is_admin from public.profiles where id = v_admin_uid), false) then
    raise exception 'admin requis';
  end if;

  -- Tous les profils onboardés (admins inclus)
  select array_agg(id order by random())
    into v_ids
    from public.profiles
   where onboarding_completed_at is not null;

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n < 2 then
    raise exception 'Il faut au moins 2 participants onboardés.';
  end if;

  -- Sattolo (cycle unique, aucun point fixe)
  for i in reverse v_n .. 2 loop
    v_j := 1 + floor(random() * (i - 1))::int;
    v_tmp := v_ids[i];
    v_ids[i] := v_ids[v_j];
    v_ids[v_j] := v_tmp;
  end loop;

  -- Purge + insertion
  delete from public.secret_friends where true;
  for i in 1 .. v_n loop
    insert into public.secret_friends (giver_id, receiver_id)
    values (v_ids[i], v_ids[1 + (i % v_n)]);
  end loop;

  return v_n;
end;
$$;
