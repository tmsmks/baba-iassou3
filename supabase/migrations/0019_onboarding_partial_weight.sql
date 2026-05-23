-- Les réponses onboarding contribuent désormais aux jauges à 50% de leur poids.
-- → onboarding 5/5 ajoute +2.5 / 15 = ~17% de la jauge
-- → onboarding 3/5 ajoute +1.5 / 15 = ~10%
-- → onboarding 1/5 ajoute +0.5 / 15 = ~3%
-- Les questions chat de la conf continuent de compter à 100%.

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
    least((
      coalesce(sum(r.score) filter (where r.lettre = 'C' and not q.is_onboarding), 0)
      + coalesce(sum(r.score) filter (where r.lettre = 'C' and q.is_onboarding), 0) * 0.5
    )::numeric / 3.0, 5.0),
    least((
      coalesce(sum(r.score) filter (where r.lettre = 'H' and not q.is_onboarding), 0)
      + coalesce(sum(r.score) filter (where r.lettre = 'H' and q.is_onboarding), 0) * 0.5
    )::numeric / 3.0, 5.0),
    least((
      coalesce(sum(r.score) filter (where r.lettre = 'O' and not q.is_onboarding), 0)
      + coalesce(sum(r.score) filter (where r.lettre = 'O' and q.is_onboarding), 0) * 0.5
    )::numeric / 3.0, 5.0),
    least((
      coalesce(sum(r.score) filter (where r.lettre = 'I' and not q.is_onboarding), 0)
      + coalesce(sum(r.score) filter (where r.lettre = 'I' and q.is_onboarding), 0) * 0.5
    )::numeric / 3.0, 5.0),
    least((
      coalesce(sum(r.score) filter (where r.lettre = 'X' and not q.is_onboarding), 0)
      + coalesce(sum(r.score) filter (where r.lettre = 'X' and q.is_onboarding), 0) * 0.5
    )::numeric / 3.0, 5.0),
    count(*) filter (where r.lettre = 'C' and r.score is not null and not q.is_onboarding),
    count(*) filter (where r.lettre = 'H' and r.score is not null and not q.is_onboarding),
    count(*) filter (where r.lettre = 'O' and r.score is not null and not q.is_onboarding),
    count(*) filter (where r.lettre = 'I' and r.score is not null and not q.is_onboarding),
    count(*) filter (where r.lettre = 'X' and r.score is not null and not q.is_onboarding),
    now()
  from public.responses r
  join public.questions q on q.id = r.question_id
  where r.user_id = p_user
  on conflict (user_id) do update set
    c_score = excluded.c_score, h_score = excluded.h_score,
    o_score = excluded.o_score, i_score = excluded.i_score, x_score = excluded.x_score,
    c_count = excluded.c_count, h_count = excluded.h_count,
    o_count = excluded.o_count, i_count = excluded.i_count, x_count = excluded.x_count,
    updated_at = now();
end;
$$;

-- Recompute toutes les jauges existantes avec la nouvelle formule
do $$
declare u uuid;
begin
  for u in select user_id from public.gauges loop
    perform public.recompute_gauges(u);
  end loop;
end $$;
