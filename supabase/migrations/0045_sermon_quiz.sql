-- Quiz de sermon : 1 question à choix multiple (4 réponses) posée AVANT puis APRÈS
-- le sermon. Les votes sont agrégés en histogramme. Un choix « positif » lors de la
-- phase APRÈS alimente la jauge CHOIX associée (récompense le changement d'avis).

-- 1 quiz par sermon
create table public.sermon_quiz (
  id uuid primary key default gen_random_uuid(),
  sermon_id uuid not null references public.sermons(id) on delete cascade,
  question text not null check (length(question) between 1 and 600),
  lettre public.letter not null,            -- jauge CHOIX alimentée par les choix positifs
  before_open boolean not null default false,
  after_open boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sermon_id)
);

create table public.sermon_quiz_options (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.sermon_quiz(id) on delete cascade,
  texte text not null check (length(texte) between 1 and 300),
  ordre int not null default 0,
  is_positive boolean not null default false,
  score smallint not null default 0 check (score between 0 and 5),
  created_at timestamptz not null default now()
);
create index on public.sermon_quiz_options(quiz_id);

create table public.sermon_quiz_votes (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.sermon_quiz(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  phase text not null check (phase in ('before', 'after')),
  option_id uuid not null references public.sermon_quiz_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, user_id, phase)
);
create index on public.sermon_quiz_votes(quiz_id, phase);
create index on public.sermon_quiz_votes(user_id);

-- ───────────────────────── RLS ─────────────────────────
alter table public.sermon_quiz enable row level security;
alter table public.sermon_quiz_options enable row level security;
alter table public.sermon_quiz_votes enable row level security;

-- quiz + options : lecture pour tous les authentifiés, écriture admin
create policy "quiz read auth" on public.sermon_quiz
  for select to authenticated using (true);
create policy "quiz admin write" on public.sermon_quiz
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "quiz options read auth" on public.sermon_quiz_options
  for select to authenticated using (true);
create policy "quiz options admin write" on public.sermon_quiz_options
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- votes : lecture pour tous les authentifiés (nécessaire au calcul de l'histogramme),
-- écriture sur soi UNIQUEMENT tant que la phase correspondante est ouverte.
create policy "quiz votes read auth" on public.sermon_quiz_votes
  for select to authenticated using (true);

create policy "quiz votes self insert" on public.sermon_quiz_votes
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.sermon_quiz q
      where q.id = quiz_id
        and ((phase = 'before' and q.before_open) or (phase = 'after' and q.after_open))
    )
  );

create policy "quiz votes self update" on public.sermon_quiz_votes
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.sermon_quiz q
      where q.id = quiz_id
        and ((phase = 'before' and q.before_open) or (phase = 'after' and q.after_open))
    )
  );

-- ─────────────────── Jauges : intégration du quiz ───────────────────
-- On étend recompute_gauges : aux réponses chat scorées par l'IA s'ajoutent les
-- votes POSITIFS de la phase APRÈS (un choix positif après le sermon marque des
-- points sur la jauge de la lettre du quiz ; un choix négatif ne pénalise pas).
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
    count(*) filter (where lettre = 'C'),
    count(*) filter (where lettre = 'H'),
    count(*) filter (where lettre = 'O'),
    count(*) filter (where lettre = 'I'),
    count(*) filter (where lettre = 'X'),
    now()
  from (
    select lettre, score
    from public.responses
    where user_id = p_user and score is not null
    union all
    select q.lettre, o.score
    from public.sermon_quiz_votes v
    join public.sermon_quiz q on q.id = v.quiz_id
    join public.sermon_quiz_options o on o.id = v.option_id
    where v.user_id = p_user and v.phase = 'after' and o.is_positive
  ) scored
  on conflict (user_id) do update set
    c_score = excluded.c_score, h_score = excluded.h_score,
    o_score = excluded.o_score, i_score = excluded.i_score, x_score = excluded.x_score,
    c_count = excluded.c_count, h_count = excluded.h_count,
    o_count = excluded.o_count, i_count = excluded.i_count, x_count = excluded.x_count,
    updated_at = now();
end;
$$;

create or replace function public.quiz_votes_after_change()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_gauges(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

create trigger sermon_quiz_votes_gauges_trg
after insert or update or delete on public.sermon_quiz_votes
for each row execute function public.quiz_votes_after_change();

-- ─────────────────── Realtime (histogramme live) ───────────────────
do $$
declare
  tbl text;
  tables text[] := array['sermon_quiz', 'sermon_quiz_options', 'sermon_quiz_votes'];
begin
  foreach tbl in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;
