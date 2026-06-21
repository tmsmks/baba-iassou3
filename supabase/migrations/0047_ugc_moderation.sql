-- App Store Guideline 1.2 : modération du contenu utilisateur
-- CLUF accepté, signalement, blocage, bannissement, filtrage de contenu.

-- 1. Profil : acceptation du CLUF + bannissement
alter table public.profiles
  add column if not exists eula_accepted_at timestamptz,
  add column if not exists banned_at timestamptz;

-- 2. Utilisateurs bloqués (par utilisateur)
create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocked_users enable row level security;

drop policy if exists "blocked self read" on public.blocked_users;
create policy "blocked self read" on public.blocked_users
  for select using (auth.uid() = blocker_id);
drop policy if exists "blocked self insert" on public.blocked_users;
create policy "blocked self insert" on public.blocked_users
  for insert with check (auth.uid() = blocker_id and blocker_id <> blocked_id);
drop policy if exists "blocked self delete" on public.blocked_users;
create policy "blocked self delete" on public.blocked_users
  for delete using (auth.uid() = blocker_id);

-- 3. Signalements de contenu
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('photo','secret_message')),
  content_id uuid not null,
  author_id uuid references public.profiles(id) on delete set null,
  reason text,
  content_excerpt text,
  status text not null default 'pending' check (status in ('pending','resolved','dismissed')),
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.content_reports enable row level security;

drop policy if exists "reports self insert" on public.content_reports;
create policy "reports self insert" on public.content_reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists "reports admin read" on public.content_reports;
create policy "reports admin read" on public.content_reports
  for select using (public.is_admin(auth.uid()));
drop policy if exists "reports admin update" on public.content_reports;
create policy "reports admin update" on public.content_reports
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create index if not exists content_reports_status_idx
  on public.content_reports(status, created_at desc);

-- 4. Le mur de photos masque les auteurs bloqués + bannis (retrait instantané du feed)
drop policy if exists "photos read auth" on public.photos;
create policy "photos read auth" on public.photos
  for select using (
    auth.uid() is not null
    and not exists (
      select 1 from public.blocked_users b
      where b.blocker_id = auth.uid() and b.blocked_id = photos.user_id
    )
    and not exists (
      select 1 from public.profiles p
      where p.id = photos.user_id and p.banned_at is not null
    )
  );

-- 5. Filtre de contenu répréhensible (mots-clés FR + EN) + blocage des comptes bannis
create or replace function public.contains_objectionable(txt text)
returns boolean language sql immutable as $$
  select txt is not null and txt ~* (
    '(' || array_to_string(array[
      'connard','encul[ée]','salope','putain','\mpute\M','\mpd\M','tapette',
      'n[eé]gre','bougnoule','youpin','sale arabe','sale juif','sale noir',
      '\mfdp\M','\mntm\M','nique ta','nique sa','b[âa]tard','sale pute',
      'fuck','\mshit\M','\mbitch\M','nigger','faggot','\mcunt\M','asshole',
      'pédophile','pedophile','suicide-toi','sale pd'
    ], '|') || ')'
  );
$$;

create or replace function public.reject_objectionable_content()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.banned_at is not null) then
    raise exception 'account_banned' using errcode = 'check_violation';
  end if;
  if tg_table_name = 'photos' and public.contains_objectionable(new.caption) then
    raise exception 'objectionable_content' using errcode = 'check_violation';
  elsif tg_table_name = 'secret_messages' and public.contains_objectionable(new.contenu) then
    raise exception 'objectionable_content' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists photos_moderation on public.photos;
create trigger photos_moderation before insert or update on public.photos
  for each row execute function public.reject_objectionable_content();
drop trigger if exists secret_messages_moderation on public.secret_messages;
create trigger secret_messages_moderation before insert or update on public.secret_messages
  for each row execute function public.reject_objectionable_content();

-- 6. Acceptation du CLUF
create or replace function public.accept_eula()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles set eula_accepted_at = coalesce(eula_accepted_at, now())
  where id = auth.uid();
end;
$$;

-- 7. Signaler un contenu
create or replace function public.report_content(p_type text, p_content_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_excerpt text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_type = 'photo' then
    select user_id, coalesce(caption, '(photo sans légende)') into v_author, v_excerpt
    from public.photos where id = p_content_id;
  elsif p_type = 'secret_message' then
    select sender_id, contenu into v_author, v_excerpt
    from public.secret_messages where id = p_content_id;
  else
    raise exception 'invalid content_type';
  end if;
  insert into public.content_reports(reporter_id, content_type, content_id, author_id, reason, content_excerpt)
  values (auth.uid(), p_type, p_content_id, v_author, p_reason, left(coalesce(v_excerpt, ''), 280));
end;
$$;

-- 8. Bloquer l'auteur d'un contenu (notifie aussi l'admin via un signalement)
create or replace function public.block_author_of(p_type text, p_content_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_excerpt text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_type = 'photo' then
    select user_id, coalesce(caption, '(photo)') into v_author, v_excerpt from public.photos where id = p_content_id;
  elsif p_type = 'secret_message' then
    select sender_id, contenu into v_author, v_excerpt from public.secret_messages where id = p_content_id;
  else
    raise exception 'invalid content_type';
  end if;
  if v_author is null then raise exception 'content not found'; end if;
  if v_author = auth.uid() then raise exception 'cannot block yourself'; end if;
  insert into public.blocked_users(blocker_id, blocked_id) values (auth.uid(), v_author)
    on conflict do nothing;
  insert into public.content_reports(reporter_id, content_type, content_id, author_id, reason, content_excerpt)
  values (auth.uid(), p_type, p_content_id, v_author, 'Utilisateur bloqué', left(coalesce(v_excerpt, ''), 280));
end;
$$;

-- 9. Débloquer
create or replace function public.unblock_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.blocked_users where blocker_id = auth.uid() and blocked_id = p_target;
end;
$$;

-- 10. La boîte de réception masque les expéditeurs bloqués
create or replace function public.get_my_secret_inbox()
returns table(id uuid, contenu text, read_at timestamp with time zone, created_at timestamp with time zone, reaction text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select sm.id, sm.contenu, sm.read_at, sm.created_at, sm.reaction
    from public.secret_messages sm
    where sm.receiver_id = auth.uid()
      and not exists (
        select 1 from public.blocked_users b
        where b.blocker_id = auth.uid() and b.blocked_id = sm.sender_id
      )
    order by sm.created_at desc;
end;
$$;

-- 11. Admin : liste des signalements
create or replace function public.admin_list_reports()
returns table(
  id uuid, content_type text, content_id uuid, reason text, content_excerpt text,
  status text, created_at timestamptz, reporter_prenom text,
  author_id uuid, author_prenom text, author_nom text, author_banned boolean
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  return query
    select r.id, r.content_type, r.content_id, r.reason, r.content_excerpt,
      r.status, r.created_at, rep.prenom,
      r.author_id, auth_p.prenom, auth_p.nom, (auth_p.banned_at is not null)
    from public.content_reports r
    left join public.profiles rep on rep.id = r.reporter_id
    left join public.profiles auth_p on auth_p.id = r.author_id
    order by (r.status = 'pending') desc, r.created_at desc
    limit 200;
end;
$$;

-- 12. Admin : résoudre un signalement (retirer le contenu et/ou bannir l'auteur)
create or replace function public.admin_resolve_report(p_report_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  select * into r from public.content_reports where id = p_report_id;
  if not found then raise exception 'report not found'; end if;

  if p_action = 'dismiss' then
    update public.content_reports
      set status = 'dismissed', resolution = 'dismiss', resolved_by = auth.uid(), resolved_at = now()
      where id = p_report_id;
    return;
  end if;

  if r.content_type = 'photo' then
    delete from public.photos where id = r.content_id;
  elsif r.content_type = 'secret_message' then
    delete from public.secret_messages where id = r.content_id;
  end if;

  if p_action = 'ban_author' and r.author_id is not null then
    update public.profiles set banned_at = now() where id = r.author_id;
  end if;

  update public.content_reports
    set status = 'resolved', resolution = p_action, resolved_by = auth.uid(), resolved_at = now()
    where id = p_report_id;

  if p_action = 'ban_author' and r.author_id is not null then
    update public.content_reports
      set status = 'resolved', resolution = 'ban_author', resolved_by = auth.uid(), resolved_at = now()
      where author_id = r.author_id and status = 'pending';
  end if;
end;
$$;
