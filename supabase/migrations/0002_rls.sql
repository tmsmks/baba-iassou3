-- Row Level Security
alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.questions enable row level security;
alter table public.question_deliveries enable row level security;
alter table public.responses enable row level security;
alter table public.gauges enable row level security;
alter table public.final_verse enable row level security;
alter table public.conference_state enable row level security;
alter table public.program enable row level security;
alter table public.program_favorites enable row level security;

-- profiles : chacun voit/édite le sien, admin voit tout
create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "profiles self insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- push_tokens : self only
create policy "push self all" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- questions : lecture pour tous les authentifiés, écriture admin
create policy "questions read auth" on public.questions
  for select to authenticated using (true);
create policy "questions admin write" on public.questions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- deliveries : user voit les siennes, admin tout. Insert via service_role (Edge Function).
create policy "deliveries self read" on public.question_deliveries
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "deliveries self update" on public.question_deliveries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- responses : user CRUD ses propres réponses
create policy "responses self read" on public.responses
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "responses self insert" on public.responses
  for insert with check (auth.uid() = user_id);

-- gauges : self read only (entretenu par trigger en SECURITY DEFINER)
create policy "gauges self read" on public.gauges
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- final_verse : self read only (insert via Edge Function service_role)
create policy "final_verse self read" on public.final_verse
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- conference_state : lecture pour tous les authentifiés, écriture admin
create policy "conf state read auth" on public.conference_state
  for select to authenticated using (true);
create policy "conf state admin write" on public.conference_state
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- program : lecture pour tous les authentifiés, écriture admin
create policy "program read auth" on public.program
  for select to authenticated using (true);
create policy "program admin write" on public.program
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- program_favorites : self CRUD
create policy "fav self all" on public.program_favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
