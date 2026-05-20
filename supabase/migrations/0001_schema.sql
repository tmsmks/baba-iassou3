-- baba IAssou3 — schéma de base
-- Lettres du thème : C, H, O, I, X (Clarté, Honnêteté, Orientation, Impartialité, X factor)

create type public.letter as enum ('C', 'H', 'O', 'I', 'X');
create type public.auth_provider as enum ('email', 'google', 'apple');

-- Profils utilisateurs (extension de auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  prenom text not null check (length(prenom) between 1 and 60),
  provider public.auth_provider not null default 'email',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Tokens Expo Push (multi-device)
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  unique (user_id, expo_token)
);
create index on public.push_tokens(user_id);

-- Catalogue de questions rédigées par l'admin
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  lettre public.letter not null,
  texte text not null,
  ordre int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.questions(lettre);

-- Livraison d'une question à un utilisateur (1 ligne par user × push)
create table public.question_deliveries (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  answered_at timestamptz,
  unique (question_id, user_id)
);
create index on public.question_deliveries(user_id, sent_at desc);

-- Réponses des utilisateurs + retour IA
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.question_deliveries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  lettre public.letter not null,
  contenu text not null check (length(contenu) between 1 and 4000),
  score smallint check (score between 0 and 20),
  ai_feedback text,
  created_at timestamptz not null default now()
);
create index on public.responses(user_id, created_at desc);
create index on public.responses(user_id, lettre);

-- Agrégat des jauges (1 ligne par user) — entretenu par trigger
create table public.gauges (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  c_score numeric(5,2) not null default 0,
  h_score numeric(5,2) not null default 0,
  o_score numeric(5,2) not null default 0,
  i_score numeric(5,2) not null default 0,
  x_score numeric(5,2) not null default 0,
  c_count int not null default 0,
  h_count int not null default 0,
  o_count int not null default 0,
  i_count int not null default 0,
  x_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Carte finale (verset personnalisé)
create table public.final_verse (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lettre_faible public.letter not null,
  verset_ref text not null,
  verset_texte text not null,
  conseil text not null,
  explication text not null,
  created_at timestamptz not null default now()
);

-- État global de la conférence (singleton)
create table public.conference_state (
  id boolean primary key default true check (id),
  is_finished boolean not null default false,
  current_question_id uuid references public.questions(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.conference_state(id) values (true);

-- Programme de la conférence
create table public.program (
  id uuid primary key default gen_random_uuid(),
  heure_debut timestamptz not null,
  heure_fin timestamptz not null check (heure_fin > heure_debut),
  titre text not null,
  intervenant text,
  description text,
  ordre int not null default 0
);
create index on public.program(heure_debut);

-- Favoris du programme
create table public.program_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.program(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);

-- Fonction utilitaire : is_admin(uid)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;
