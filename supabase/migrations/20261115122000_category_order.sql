-- One transaction for the entire order, respecting existing household RLS.
create function public.reorder_categories(p_household uuid,p_ids uuid[],p_expected jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare current_order jsonb; current_ids uuid[]; begin
  perform id from public.households where id=p_household for update;
  if not found then raise exception 'Accesso non consentito' using errcode='42501'; end if;
  perform id from public.categories where household_id=p_household order by id for update;
  select coalesce(jsonb_object_agg(id::text,sort_order),'{}'::jsonb),coalesce(array_agg(id order by id),'{}'::uuid[])
    into current_order,current_ids from public.categories where household_id=p_household;
  if current_order is distinct from p_expected or p_ids is null or
    current_ids is distinct from array(select id from unnest(p_ids) as ids(id) order by id) then
    raise exception 'Conflitto: le categorie sono cambiate. Ricarica le categorie e riprova.';
  end if;
  update public.categories c set sort_order=ids.position::integer-1
    from unnest(p_ids) with ordinality as ids(id,position)
    where c.id=ids.id and c.household_id=p_household;
end $$;
revoke all on function public.reorder_categories(uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.reorder_categories(uuid,uuid[],jsonb) to authenticated;

-- The existing client subscription refreshes the shopping groups on category changes.
alter publication supabase_realtime add table public.categories;
