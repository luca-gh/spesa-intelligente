create function public.apply_plan_diff(p_list uuid,p_plan uuid,p_version integer,p_rows jsonb,p_plan_version integer) returns void language plpgsql security definer set search_path='' as $$
declare l public.shopping_lists; row jsonb; item uuid; projected numeric; bought numeric; affected uuid[]; begin
  select * into l from public.shopping_lists where id=p_list for update;
  if not private.is_member(l.household_id) then raise exception 'Accesso negato'; end if;
  if l.version<>p_version then raise exception 'Lista modificata: ricalcola anteprima'; end if;
  perform 1 from public.meal_plans where id=p_plan and household_id=l.household_id and version=p_plan_version for update;
  if not found then raise exception 'Lista modificata: il piano è cambiato, ricalcola anteprima'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'Diff non valido'; end if;
  select array_agg(item_id) into affected from public.list_item_contributions where origin_type='plan' and origin_id=p_plan and item_id in(select id from public.shopping_list_items where list_id=p_list);
  -- Remove only this plan, inside this transaction. A conflict rolls everything back.
  delete from public.list_item_contributions where origin_type='plan' and origin_id=p_plan and item_id in (select id from public.shopping_list_items where list_id=p_list);
  for row in select * from jsonb_array_elements(p_rows) loop
    select id into item from public.shopping_list_items where list_id=p_list and generic_product_id=(row->>'product_id')::uuid and unit=row->>'unit' order by created_at,id limit 1;
    if item is null then
      insert into public.shopping_list_items(household_id,list_id,generic_product_id,name,unit)
        select l.household_id,p_list,id,name,row->>'unit' from public.generic_products where id=(row->>'product_id')::uuid and household_id=l.household_id returning id into item;
      if item is null then raise exception 'Ingrediente non valido'; end if;
    end if;
    insert into public.list_item_contributions(household_id,item_id,origin_type,origin_id,requested_quantity) values(l.household_id,item,'plan',p_plan,(row->>'quantity')::numeric)
      on conflict(item_id,origin_type,origin_id) do update set requested_quantity=public.list_item_contributions.requested_quantity+excluded.requested_quantity;
    affected:=array_append(affected,item);
  end loop;
  for item in select distinct unnest(affected) loop
    select coalesce(sum(requested_quantity),0) into projected from public.list_item_contributions where item_id=item;
    select coalesce(sum(quantity),0) into bought from public.purchases where list_item_id=item and voided_at is null;
    if projected<bought then raise exception 'Conflitto: quantità già acquistata superiore alla proposta'; end if;
  end loop;
  update public.shopping_lists set version=version+1,updated_at=now() where id=p_list;
  update public.meal_plans set linked_list_id=p_list where id=p_plan;
end $$;
revoke all on function public.apply_plan_diff(uuid,uuid,integer,jsonb,integer) from public;
grant execute on function public.apply_plan_diff(uuid,uuid,integer,jsonb,integer) to authenticated;

create function public.remove_list_item(p_item uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare item public.shopping_list_items; l public.shopping_lists; begin
  select * into item from public.shopping_list_items where id=p_item;
  if not private.is_member(item.household_id) then raise exception 'Accesso negato'; end if;
  select * into l from public.shopping_lists where id=item.list_id for update;
  if l.version<>p_version then raise exception 'Lista modificata: ricarica'; end if;
  if exists(select 1 from public.purchases where list_item_id=p_item) then raise exception 'Articolo con storico acquisti: impossibile eliminare'; end if;
  delete from public.shopping_list_items where id=p_item;
  update public.shopping_lists set version=version+1,updated_at=now() where id=item.list_id;
end $$;
revoke all on function public.remove_list_item(uuid,integer) from public;
grant execute on function public.remove_list_item(uuid,integer) to authenticated;

create function public.update_manual_item(p_item uuid,p_version integer,p_quantity numeric,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare item public.shopping_list_items; l public.shopping_lists; begin
  select * into item from public.shopping_list_items where id=p_item;
  if not private.is_member(item.household_id) then raise exception 'Accesso negato'; end if;
  select * into l from public.shopping_lists where id=item.list_id for update;
  if l.version<>p_version then raise exception 'Lista modificata: ricarica'; end if;
  if p_quantity<0 then raise exception 'Quantità non valida'; end if;
  insert into public.list_item_contributions(household_id,item_id,origin_type,origin_id,requested_quantity) values(item.household_id,p_item,'manual',p_item,p_quantity)
    on conflict(item_id,origin_type,origin_id) do update set requested_quantity=excluded.requested_quantity;
  update public.shopping_list_items set note=left(p_note,2000) where id=p_item;
  update public.shopping_lists set version=version+1,updated_at=now() where id=item.list_id;
end $$;
revoke all on function public.update_manual_item(uuid,integer,numeric,text) from public;
grant execute on function public.update_manual_item(uuid,integer,numeric,text) to authenticated;
