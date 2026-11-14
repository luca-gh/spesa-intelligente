-- Remove categories without deleting products; retain financial and planning history.
alter table public.generic_products add column archived_at timestamptz;
alter table public.specific_products add column archived_at timestamptz;
alter table public.recipes add column archived_at timestamptz;
alter table public.meal_plans add column archived_at timestamptz;
alter table public.shopping_list_items add column archived_at timestamptz;
alter table public.price_estimate_snapshots add column archived_at timestamptz;

create function public.delete_category(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
  select household_id into h from public.categories where id=p_id for update;
  if h is null or not private.is_member(h) then raise exception 'Accesso negato'; end if;
  update public.generic_products set category_id=null where category_id=p_id and household_id=h;
  delete from public.categories where id=p_id and household_id=h;
end $$;

create function public.set_record_archived(p_type text,p_id uuid,p_archived boolean,p_version integer default null) returns void
language plpgsql security definer set search_path='' as $$
declare h uuid; parent_id uuid; current_version integer; stamp timestamptz;
begin
  if p_archived is null then raise exception 'Quantità non valida: stato mancante'; end if;
  if p_type not in ('generic_products','specific_products','recipes','stores','meal_plans','shopping_list_items','price_estimate_snapshots') or p_type is null then
    raise exception 'Accesso negato';
  end if;
  execute format('select household_id from public.%I where id=$1',p_type) into h using p_id;
  if h is null or not private.is_member(h) then raise exception 'Accesso negato'; end if;
  if p_type='shopping_list_items' then
    select list_id into parent_id from public.shopping_list_items where id=p_id;
    select version into current_version from public.shopping_lists where id=parent_id for update;
    if p_version is distinct from current_version then raise exception 'Lista modificata: ricarica'; end if;
    update public.shopping_lists set version=version+1,updated_at=now() where id=parent_id;
  elsif p_type='meal_plans' then
    select version into current_version from public.meal_plans where id=p_id for update;
    if p_version is distinct from current_version then raise exception 'Conflitto: piano modificato, ricarica'; end if;
    update public.meal_plans set version=version+1 where id=p_id;
  end if;
  stamp:=case when p_archived then now() else null end;
  execute format('update public.%I set archived_at=$1 where id=$2 and household_id=$3',p_type) using stamp,p_id,h;
end $$;

revoke all on function public.delete_category(uuid) from public,anon;
revoke all on function public.set_record_archived(text,uuid,boolean,integer) from public,anon;
grant execute on function public.delete_category(uuid) to authenticated;
grant execute on function public.set_record_archived(text,uuid,boolean,integer) to authenticated;

-- A later confirmed plan update must not silently add quantities to a hidden item.
-- Restore only items touched by that explicit update, within its existing transaction.
create function private.restore_plan_item() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.shopping_list_items set archived_at=null where id=new.item_id and archived_at is not null;
  return new;
end $$;
revoke all on function private.restore_plan_item() from public,anon,authenticated;
create trigger restore_plan_item after insert or update on public.list_item_contributions
for each row execute function private.restore_plan_item();


-- Duplicating a list includes its visible items only.
create or replace function public.duplicate_list(p_list uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare l public.shopping_lists; result uuid; row record; item uuid; begin
  select * into l from public.shopping_lists where id=p_list for update;
  if not private.is_member(l.household_id) then raise exception 'Accesso negato'; end if;
  insert into public.shopping_lists(household_id,title) values(l.household_id,left(l.title,185)||' (copia)') returning id into result;
  for row in select i.*,coalesce((select sum(requested_quantity) from public.list_item_contributions where item_id=i.id),0) as requested from public.shopping_list_items i where list_id=p_list and i.archived_at is null loop
    insert into public.shopping_list_items(household_id,list_id,name,unit,generic_product_id,specific_product_id,note,sort_order) values(l.household_id,result,row.name,row.unit,row.generic_product_id,row.specific_product_id,row.note,row.sort_order) returning id into item;
    insert into public.list_item_contributions(household_id,item_id,origin_type,origin_id,requested_quantity) values(l.household_id,item,'manual',item,row.requested);
  end loop;
  return result;
end $$;
