create function public.delete_household(p_household uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare h public.households; begin
  select * into h from public.households where id=p_household for update;
  if not private.is_member(p_household) or p_confirmation is distinct from h.name then raise exception 'Accesso negato o conferma errata'; end if;
  if (select count(*) from public.household_members where household_id=p_household and status='active')<>1 then raise exception 'Gli altri membri devono prima lasciare la famiglia'; end if;
  delete from public.households where id=p_household;
end $$;
revoke all on function public.delete_household(uuid,text) from public;
grant execute on function public.delete_household(uuid,text) to authenticated;
