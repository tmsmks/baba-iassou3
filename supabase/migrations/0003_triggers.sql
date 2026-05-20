-- Trigger : à chaque INSERT/UPDATE/DELETE sur responses, recalculer gauges pour cet user.
create or replace function public.recompute_gauges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gauges as g (user_id,
    c_score, h_score, o_score, i_score, x_score,
    c_count, h_count, o_count, i_count, x_count,
    updated_at)
  select
    p_user,
    coalesce(avg(score) filter (where lettre = 'C'), 0),
    coalesce(avg(score) filter (where lettre = 'H'), 0),
    coalesce(avg(score) filter (where lettre = 'O'), 0),
    coalesce(avg(score) filter (where lettre = 'I'), 0),
    coalesce(avg(score) filter (where lettre = 'X'), 0),
    count(*) filter (where lettre = 'C' and score is not null),
    count(*) filter (where lettre = 'H' and score is not null),
    count(*) filter (where lettre = 'O' and score is not null),
    count(*) filter (where lettre = 'I' and score is not null),
    count(*) filter (where lettre = 'X' and score is not null),
    now()
  from public.responses
  where user_id = p_user
  on conflict (user_id) do update set
    c_score = excluded.c_score, h_score = excluded.h_score,
    o_score = excluded.o_score, i_score = excluded.i_score, x_score = excluded.x_score,
    c_count = excluded.c_count, h_count = excluded.h_count,
    o_count = excluded.o_count, i_count = excluded.i_count, x_count = excluded.x_count,
    updated_at = now();
end;
$$;

create or replace function public.responses_after_change()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_gauges(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

create trigger responses_gauges_trg
after insert or update or delete on public.responses
for each row execute function public.responses_after_change();

-- Création auto de profile + gauges + handle_new_user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prenom text;
  v_provider public.auth_provider;
begin
  v_prenom := coalesce(
    new.raw_user_meta_data->>'prenom',
    new.raw_user_meta_data->>'given_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  v_provider := case
    when new.raw_app_meta_data->>'provider' = 'google' then 'google'::auth_provider
    when new.raw_app_meta_data->>'provider' = 'apple' then 'apple'::auth_provider
    else 'email'::auth_provider
  end;

  insert into public.profiles(id, email, prenom, provider)
  values (new.id, new.email, v_prenom, v_provider)
  on conflict (id) do nothing;

  insert into public.gauges(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
