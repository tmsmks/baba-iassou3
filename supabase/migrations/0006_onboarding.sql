-- Onboarding : 5 questions Likert qui seedent les jauges CHOIX dès l'inscription.

-- Profils : drapeau de complétion
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz null;

-- Questions : marquer celles d'onboarding pour les exclure du chat
alter table public.questions
  add column if not exists is_onboarding boolean not null default false;

create index if not exists questions_onboarding_idx
  on public.questions(is_onboarding) where is_onboarding = true;

-- Seed des 5 questions d'onboarding (idempotent via NOT EXISTS)
insert into public.questions (lettre, texte, ordre, is_onboarding)
select * from (values
  ('C'::public.letter, 'Je sais quelle valeur me guide quand je dois choisir entre 2 options qui paraissent toutes les deux bonnes — devant moi et devant Dieu.', 1, true),
  ('H'::public.letter, 'Je peux nommer quelque chose (péché, habitude, motivation cachée) que je traîne depuis longtemps et que je n''ai pas vraiment lâché.', 2, true),
  ('O'::public.letter, 'Mes choix de cette année (filière, relations, temps, argent) vont vraiment dans le sens de qui Dieu m''appelle à devenir.', 3, true),
  ('I'::public.letter, 'Quand un proche (ami, parent, frère/sœur dans la foi) me reprend, je l''écoute avant de me défendre.', 4, true),
  ('X'::public.letter, 'Je peux faire un choix important sans tout maîtriser, en remettant le reste à Dieu.', 5, true)
) as v(lettre, texte, ordre, is_onboarding)
where not exists (
  select 1 from public.questions q
  where q.is_onboarding = true and q.lettre = v.lettre::public.letter
);

-- RPC : enregistre les 5 réponses d'onboarding, met à jour profile.onboarding_completed_at
-- Body attendu : jsonb { "C": 1..5, "H": 1..5, "O": 1..5, "I": 1..5, "X": 1..5 }
create or replace function public.complete_onboarding(answers jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_letter public.letter;
  v_value int;
  v_score smallint;
  v_question_id uuid;
  v_delivery_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Idempotence : on ne refait rien si déjà complété
  if exists (select 1 from public.profiles where id = v_user and onboarding_completed_at is not null) then
    return;
  end if;

  for v_letter in select unnest(array['C','H','O','I','X']::public.letter[]) loop
    v_value := coalesce((answers->>v_letter::text)::int, 0);
    if v_value < 1 or v_value > 5 then
      raise exception 'answer for % must be between 1 and 5', v_letter;
    end if;
    v_score := v_value::smallint;

    select id into v_question_id
    from public.questions
    where is_onboarding = true and lettre = v_letter
    limit 1;
    if v_question_id is null then
      raise exception 'onboarding question for letter % not found', v_letter;
    end if;

    insert into public.question_deliveries(question_id, user_id, sent_at, opened_at, answered_at)
    values (v_question_id, v_user, now(), now(), now())
    on conflict (question_id, user_id) do update set answered_at = now()
    returning id into v_delivery_id;

    insert into public.responses(delivery_id, user_id, question_id, lettre, contenu, score)
    values (v_delivery_id, v_user, v_question_id, v_letter, 'Onboarding: ' || v_value::text || '/5', v_score);
  end loop;

  update public.profiles
  set onboarding_completed_at = now()
  where id = v_user;
end;
$$;

grant execute on function public.complete_onboarding(jsonb) to authenticated;
