-- Suppression de compte par l'utilisateur lui-même (exigence App Store :
-- toute app avec création de compte doit permettre la suppression in-app).
-- On supprime la ligne auth.users de l'appelant ; le reste (profil, jauges,
-- réponses, ami secret, photos, messages…) part en cascade via les FK
-- `on delete cascade`, exactement comme admin_delete_user.

create or replace function public.delete_my_account()
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
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
