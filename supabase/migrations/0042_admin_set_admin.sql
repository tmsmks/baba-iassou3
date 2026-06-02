-- RPC pour qu'un admin puisse promouvoir / rétrograder un autre administrateur
-- directement depuis l'app (onglet Utilisateurs).

create or replace function public.admin_set_admin(target_user_id uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seul un admin peut désigner d'autres admins.
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'admin requis';
  end if;

  -- Garde-fou : on ne peut pas se retirer soi-même le rôle admin
  -- (évite de se verrouiller dehors).
  if target_user_id = auth.uid() and value = false then
    raise exception 'Tu ne peux pas te retirer ton propre rôle admin.';
  end if;

  update public.profiles
    set is_admin = value,
        -- Promouvoir admin retire le rôle modérateur (admin > modérateur) ;
        -- rétrograder ne touche pas au rôle modérateur existant.
        is_moderator = case when value then false else is_moderator end
  where id = target_user_id;
end;
$$;

grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
