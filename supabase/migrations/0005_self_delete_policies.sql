-- Permettre à chaque utilisateur (et admin sur son propre compte) de réinitialiser
-- sa conversation / verset depuis l'app.

create policy "deliveries self delete" on public.question_deliveries
  for delete using (auth.uid() = user_id);

create policy "responses self delete" on public.responses
  for delete using (auth.uid() = user_id);

create policy "final_verse self delete" on public.final_verse
  for delete using (auth.uid() = user_id);
