-- Active Supabase Realtime sur les tables modifiées par l'admin pour que tous
-- les clients voient les changements instantanément (FAQ ouverte, état conférence,
-- programme, chants, photos…).

do $$
declare
  tbl text;
  tables text[] := array[
    'sermons',
    'conference_state',
    'program',
    'chants',
    'photos',
    'photo_likes',
    'secret_messages',
    'secret_friends'
  ];
begin
  foreach tbl in array tables loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = tbl) then
      begin
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      exception
        when duplicate_object then
          -- déjà dans la publication, on passe
          null;
      end;
    end if;
  end loop;
end $$;
