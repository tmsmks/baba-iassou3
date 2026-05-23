-- Chants : table + bucket Storage public pour héberger les PDFs.

create table if not exists public.chants (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (length(titre) between 1 and 120),
  url text not null,
  ordre int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists chants_ordre_idx on public.chants(ordre);

alter table public.chants enable row level security;

create policy "chants read auth" on public.chants
  for select to authenticated using (true);
create policy "chants admin write" on public.chants
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Bucket Storage public pour les PDFs. Le bucket public.chants doit aussi être créé
-- depuis le dashboard Supabase → Storage → New bucket → name = "chants", Public = on.
-- (les policies de Storage ci-dessous ne s'appliquent qu'aux buckets existants)
do $$
begin
  -- Tente d'insérer le bucket (idempotent)
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('chants', 'chants', true, 20971520, array['application/pdf'])
  on conflict (id) do nothing;
exception when others then
  -- Si storage.buckets n'est pas accessible via migration (RLS), on ignore — à créer manuellement.
  null;
end $$;

-- Policies storage : lecture publique, write admin only
do $$
begin
  begin
    create policy "chants public read" on storage.objects
      for select using (bucket_id = 'chants');
  exception when duplicate_object then null;
  end;
  begin
    create policy "chants admin write" on storage.objects
      for insert with check (
        bucket_id = 'chants'
        and public.is_admin(auth.uid())
      );
  exception when duplicate_object then null;
  end;
  begin
    create policy "chants admin update" on storage.objects
      for update using (
        bucket_id = 'chants'
        and public.is_admin(auth.uid())
      );
  exception when duplicate_object then null;
  end;
  begin
    create policy "chants admin delete" on storage.objects
      for delete using (
        bucket_id = 'chants'
        and public.is_admin(auth.uid())
      );
  exception when duplicate_object then null;
  end;
end $$;
