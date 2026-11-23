-- Same categories, independent aisle order per store. Existing global order is retained as the default.
alter table public.shopping_list_items
  add column preferred_brand text check(preferred_brand is null or length(preferred_brand) between 1 and 200),
  add column preferred_package_quantity numeric(14,3) check(preferred_package_quantity > 0),
  add column preferred_package_unit text check(preferred_package_unit in ('g','kg','ml','L','pz','conf')),
  add constraint complete_preferred_format check((preferred_package_quantity is null)=(preferred_package_unit is null));

create function private.add_shopping_product(p_list uuid,p_name text,p_quantity numeric,p_unit text,
  p_generic uuid,p_specific uuid,p_brand text,p_package_quantity numeric,p_package_unit text) returns uuid
language plpgsql security definer set search_path='' as $$
declare h uuid; result uuid; begin
  select household_id into h from public.shopping_lists where id=p_list;
  if auth.uid() is null or h is null or not private.is_member(h) then raise exception 'Accesso negato' using errcode='42501'; end if;
  if p_generic is null and (p_brand is not null or p_package_quantity is not null or p_package_unit is not null) then
    raise exception 'Quantità non valida: le preferenze richiedono un prodotto del catalogo';
  end if;
  result:=public.add_list_item(p_list,p_name,p_quantity,p_unit,p_generic,p_specific);
  update public.shopping_list_items set preferred_brand=nullif(btrim(p_brand),''),
    preferred_package_quantity=p_package_quantity,preferred_package_unit=p_package_unit
    where id=result and household_id=h;
  return result;
end $$;
revoke all on function private.add_shopping_product(uuid,text,numeric,text,uuid,uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function private.add_shopping_product(uuid,text,numeric,text,uuid,uuid,text,numeric,text) to authenticated;
create function public.add_shopping_product(p_list uuid,p_name text,p_quantity numeric,p_unit text,
  p_generic uuid default null,p_specific uuid default null,p_brand text default null,
  p_package_quantity numeric default null,p_package_unit text default null) returns uuid
language sql security invoker set search_path='' as $$
  select private.add_shopping_product(p_list,p_name,p_quantity,p_unit,p_generic,p_specific,p_brand,p_package_quantity,p_package_unit);
$$;
revoke all on function public.add_shopping_product(uuid,text,numeric,text,uuid,uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.add_shopping_product(uuid,text,numeric,text,uuid,uuid,text,numeric,text) to authenticated;

create table public.store_category_order (
  household_id uuid not null references public.households(id) on delete cascade,
  store_id uuid not null,
  category_id uuid not null,
  sort_order integer not null default 0 check(sort_order >= 0),
  primary key(store_id,category_id),
  foreign key(store_id,household_id) references public.stores(id,household_id) on delete cascade,
  foreign key(category_id,household_id) references public.categories(id,household_id) on delete cascade
);
create index store_category_order_household on public.store_category_order(household_id);
create index store_category_order_category on public.store_category_order(category_id,household_id);
alter table public.store_category_order enable row level security;
revoke all on public.store_category_order from public,anon,authenticated;
grant select,insert,update,delete on public.store_category_order to authenticated;
create policy member_read on public.store_category_order for select to authenticated
  using(private.is_member(household_id));
create policy member_write on public.store_category_order for all to authenticated
  using(private.is_member(household_id)) with check(private.is_member(household_id));

insert into public.store_category_order(household_id,store_id,category_id,sort_order)
select s.household_id,s.id,c.id,
  (row_number() over(partition by s.id order by c.sort_order,c.name,c.id)-1)::integer
from public.stores s join public.categories c on c.household_id=s.household_id;

create function private.seed_store_categories() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  perform id from public.households where id=new.household_id for update;
  if tg_table_name='stores' then
    insert into public.store_category_order(household_id,store_id,category_id,sort_order)
      select new.household_id,new.id,c.id,(row_number() over(order by c.sort_order,c.name,c.id)-1)::integer
      from public.categories c where c.household_id=new.household_id;
  else
    insert into public.store_category_order(household_id,store_id,category_id,sort_order)
      select new.household_id,s.id,new.id,
        coalesce((select max(o.sort_order)+1 from public.store_category_order o where o.store_id=s.id),0)
      from public.stores s where s.household_id=new.household_id;
  end if;
  return new;
end $$;
revoke all on function private.seed_store_categories() from public,anon,authenticated;
create trigger seed_store_categories after insert on public.stores
  for each row execute function private.seed_store_categories();
create trigger seed_category_stores after insert on public.categories
  for each row execute function private.seed_store_categories();

create function public.reorder_store_categories(p_store uuid,p_ids uuid[],p_expected jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare current_order jsonb; current_ids uuid[]; begin
  perform id from public.stores where id=p_store and archived_at is null for update;
  if not found then raise exception 'Accesso non consentito' using errcode='42501'; end if;
  perform category_id from public.store_category_order where store_id=p_store order by category_id for update;
  select coalesce(jsonb_object_agg(category_id::text,sort_order),'{}'::jsonb),
    coalesce(array_agg(category_id order by category_id),'{}'::uuid[])
    into current_order,current_ids from public.store_category_order where store_id=p_store;
  if current_order is distinct from p_expected or p_ids is null or
    current_ids is distinct from array(select id from unnest(p_ids) as ids(id) order by id) then
    raise exception 'Conflitto: le categorie sono cambiate. Ricarica le categorie e riprova.';
  end if;
  update public.store_category_order o set sort_order=ids.position::integer-1
    from unnest(p_ids) with ordinality as ids(id,position)
    where o.store_id=p_store and o.category_id=ids.id;
end $$;
revoke all on function public.reorder_store_categories(uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.reorder_store_categories(uuid,uuid[],jsonb) to authenticated;
alter publication supabase_realtime add table public.store_category_order;
alter publication supabase_realtime add table public.price_observations;

-- Price corrections are atomic: the previous observation remains voided in history.
-- Price observations deliberately do not grant direct DML to authenticated users.
create function private.correct_catalog_price(p_id uuid,p_amount numeric,p_kind text,
  p_observed timestamptz,p_start date,p_end date) returns uuid
language plpgsql security definer set search_path='' as $$
declare old public.price_observations; result uuid; begin
  if auth.uid() is null then raise exception 'Accesso negato' using errcode='42501'; end if;
  select * into old from public.price_observations
    where id=p_id and private.is_member(household_id) for update;
  if not found then raise exception 'Accesso negato' using errcode='42501'; end if;
  if old.voided_at is not null then raise exception 'Conflitto: il prezzo è già stato modificato. Ricarica e riprova.'; end if;
  insert into public.price_observations(household_id,specific_product_id,store_id,price_amount,kind,
    observed_at,promotion_starts_at,promotion_ends_at)
    values(old.household_id,old.specific_product_id,old.store_id,p_amount,p_kind,p_observed,p_start,p_end)
    returning id into result;
  update public.price_observations set voided_at=now() where id=old.id and household_id=old.household_id;
  return result;
end $$;
revoke all on function private.correct_catalog_price(uuid,numeric,text,timestamptz,date,date) from public,anon,authenticated;
grant execute on function private.correct_catalog_price(uuid,numeric,text,timestamptz,date,date) to authenticated;
create function public.correct_catalog_price(p_id uuid,p_amount numeric,p_kind text,
  p_observed timestamptz,p_start date default null,p_end date default null) returns uuid
language sql security invoker set search_path='' as $$
  select private.correct_catalog_price(p_id,p_amount,p_kind,p_observed,p_start,p_end);
$$;
revoke all on function public.correct_catalog_price(uuid,numeric,text,timestamptz,date,date) from public,anon,authenticated;
grant execute on function public.correct_catalog_price(uuid,numeric,text,timestamptz,date,date) to authenticated;
