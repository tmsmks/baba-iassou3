-- Réactions emoji sur les messages secrets (du destinataire vers l'expéditeur).

alter table public.secret_messages
  add column if not exists reaction text null;

-- Recréation des RPC pour inclure le champ reaction
drop function if exists public.get_my_secret_inbox();
create function public.get_my_secret_inbox()
returns table (
  id uuid,
  contenu text,
  read_at timestamptz,
  created_at timestamptz,
  reaction text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  return query
    select sm.id, sm.contenu, sm.read_at, sm.created_at, sm.reaction
    from public.secret_messages sm
    where sm.receiver_id = auth.uid()
    order by sm.created_at desc;
end;
$$;
grant execute on function public.get_my_secret_inbox() to authenticated;

drop function if exists public.get_my_secret_outbox();
create function public.get_my_secret_outbox()
returns table (
  id uuid,
  contenu text,
  read_at timestamptz,
  created_at timestamptz,
  reaction text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  return query
    select sm.id, sm.contenu, sm.read_at, sm.created_at, sm.reaction
    from public.secret_messages sm
    where sm.sender_id = auth.uid()
    order by sm.created_at desc;
end;
$$;
grant execute on function public.get_my_secret_outbox() to authenticated;

-- RPC pour poser/retirer une réaction (uniquement le destinataire)
create or replace function public.react_to_secret_message(message_id uuid, emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if emoji is not null and emoji <> '' and emoji not in ('❤️','🙏','😂','🔥','👍') then
    raise exception 'emoji invalide';
  end if;

  update public.secret_messages
     set reaction = nullif(emoji, '')
   where id = message_id
     and receiver_id = v_uid;

  if not found then
    raise exception 'message introuvable ou non destiné à cet utilisateur';
  end if;
end;
$$;
grant execute on function public.react_to_secret_message(uuid, text) to authenticated;
