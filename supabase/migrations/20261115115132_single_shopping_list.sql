-- Retain every existing identifier, item, contribution, purchase and snapshot.
-- Multiple legacy lists require an explicit reconciliation, never silent deletion.
lock table public.shopping_lists in access exclusive mode;
do $$ begin
  if exists(select 1 from public.shopping_lists group by household_id having count(*) > 1) then
    raise exception 'Migrazione annullata: riconciliare le liste multiple prima di procedere.';
  end if;
end $$;

alter table public.shopping_lists add constraint shopping_lists_one_per_household unique(household_id);
update public.shopping_lists set status='active', version=version+1, updated_at=now() where status<>'active';
alter table public.shopping_lists add constraint shopping_lists_always_active check(status='active');

create function public.ensure_shopping_list(p_household uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid; begin
  if not exists(select 1 from public.households where id=p_household) then
    raise exception 'Accesso non consentito' using errcode='42501';
  end if;
  insert into public.shopping_lists(household_id,title) values(p_household,'Lista della spesa')
    on conflict(household_id) do nothing;
  select id into result from public.shopping_lists where household_id=p_household;
  return result;
end $$;
revoke all on function public.ensure_shopping_list(uuid) from public, anon, authenticated;
grant execute on function public.ensure_shopping_list(uuid) to authenticated;
revoke all on function public.duplicate_list(uuid) from public, anon, authenticated;
