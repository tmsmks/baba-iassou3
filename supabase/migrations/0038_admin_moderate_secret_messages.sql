-- RPC pour que l'admin puisse lire tous les messages secrets (avec noms expéditeur/destinataire).

create or replace function public.admin_get_secret_messages()
returns table (
  id uuid,
  contenu text,
  created_at timestamptz,
  sender_prenom text,
  sender_nom text,
  receiver_prenom text,
  receiver_nom text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((select is_admin from public.profiles where profiles.id = auth.uid()), false) then
    raise exception 'admin requis';
  end if;

  return query
    select
      sm.id,
      sm.contenu,
      sm.created_at,
      sp.prenom as sender_prenom,
      coalesce(sp.nom, '') as sender_nom,
      rp.prenom as receiver_prenom,
      coalesce(rp.nom, '') as receiver_nom
    from public.secret_messages sm
    join public.profiles sp on sp.id = sm.sender_id
    join public.profiles rp on rp.id = sm.receiver_id
    order by sm.created_at desc;
end;
$$;

grant execute on function public.admin_get_secret_messages() to authenticated;

-- Policy pour permettre à l'admin de supprimer des messages secrets.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'secret_messages' and policyname = 'admin_delete_secret_messages'
  ) then
    execute $policy$
      create policy admin_delete_secret_messages on public.secret_messages
        for delete to authenticated
        using (
          coalesce((select is_admin from public.profiles where id = auth.uid()), false)
        )
    $policy$;
  end if;
end $$;
