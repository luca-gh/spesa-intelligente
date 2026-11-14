-- Optional product metadata, with existing identifiers and financial history retained.
alter table public.generic_products alter column canonical_unit drop not null;
alter table public.generic_products add column is_catalog_group boolean not null default false;
alter table public.specific_products alter column package_quantity drop not null;
alter table public.specific_products alter column package_unit drop not null;
alter table public.specific_products add constraint complete_optional_format
  check ((package_quantity is null) = (package_unit is null));
-- Existing name-only entries receive a visible card, without inventing a package size.
insert into public.specific_products(household_id,generic_product_id,name,package_quantity,package_unit,archived_at)
select g.household_id,g.id,g.name,null,null,g.archived_at from public.generic_products g
where not exists(select 1 from public.specific_products s where s.generic_product_id=g.id and s.household_id=g.household_id);
update public.generic_products g set is_catalog_group=true
where exists(select 1 from public.specific_products s where s.generic_product_id=g.id and s.household_id=g.household_id);

-- Invoker security retains table RLS and composite household foreign keys.
create function public.save_catalog_product(
  p_name text, p_category uuid default null, p_brand text default '', p_barcode text default null,
  p_quantity numeric default null, p_unit text default null, p_variant text default '',
  p_id uuid default null, p_specific boolean default false
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h uuid; g public.generic_products; s public.specific_products; result uuid;
begin
  select household_id into h from public.household_members where user_id=auth.uid() and status='active';
  if h is null then raise exception 'Accesso negato'; end if;
  p_name:=btrim(p_name); p_brand:=coalesce(btrim(p_brand),''); p_variant:=coalesce(btrim(p_variant),'');
  p_barcode:=nullif(btrim(p_barcode),''); p_unit:=nullif(btrim(p_unit),'');
  if p_name is null or length(p_name) not between 1 and 200 then raise exception 'Quantità non valida: inserisci il nome del prodotto'; end if;
  if (p_quantity is null)<>(p_unit is null) or p_quantity<=0 then raise exception 'Quantità non valida: completa quantità e unità del formato, oppure lascia entrambi vuoti'; end if;
  if p_barcode is not null and not private.valid_ean(p_barcode) then raise exception 'Quantità non valida: controlla il checksum del barcode EAN'; end if;
  if p_category is not null and not exists(select 1 from public.categories where id=p_category and household_id=h) then raise exception 'Accesso negato'; end if;
  if p_id is not null then
    if p_specific then
      select * into s from public.specific_products where id=p_id and household_id=h for update;
      if not found then raise exception 'Accesso negato'; end if;
      if p_name=s.name then select * into g from public.generic_products where id=s.generic_product_id and household_id=h for update; end if;
    else
      select * into g from public.generic_products where id=p_id and household_id=h for update;
      if not found then raise exception 'Accesso negato'; end if;
      if g.is_catalog_group then raise exception 'Conflitto: seleziona la scheda del prodotto'; end if;
      update public.generic_products set name=p_name,category_id=p_category where id=g.id;
    end if;
  end if;
  if g.id is null then
    -- Serialize same-name submissions without locking an unrelated household.
    perform pg_advisory_xact_lock(hashtextextended(h::text||':'||p_name,0));
    select * into g from public.generic_products where household_id=h and name=p_name for update;
    if g.id is null then
      insert into public.generic_products(household_id,name,category_id,canonical_unit,is_catalog_group)
      values(h,p_name,p_category,p_unit,true) returning * into g;
    end if;
  end if;
  if g.archived_at is not null and not g.is_catalog_group then raise exception 'Conflitto: il prodotto è archiviato, ripristinalo prima di modificarlo'; end if;
    if s.id is not null then
      update public.specific_products set name=p_name,generic_product_id=g.id,brand=p_brand,variant=p_variant,
        barcode=p_barcode,package_quantity=p_quantity,package_unit=p_unit where id=s.id returning id into result;
    else
      if exists(select 1 from public.specific_products where household_id=h and generic_product_id=g.id and brand=p_brand and variant=p_variant
        and barcode is not distinct from p_barcode and package_quantity is not distinct from p_quantity and package_unit is not distinct from p_unit)
      then raise exception 'duplicate key: prodotto già presente' using errcode='23505'; end if;
      insert into public.specific_products(household_id,name,generic_product_id,brand,variant,barcode,package_quantity,package_unit)
      values(h,p_name,g.id,p_brand,p_variant,p_barcode,p_quantity,p_unit) returning id into result;
      -- Enriching an existing plain product replaces its visible card, not its identity in lists/recipes.
      if p_id is not null and not p_specific then update public.generic_products set is_catalog_group=true where id=g.id; end if;
    end if;
    update public.generic_products set category_id=p_category where id=g.id;
    return jsonb_build_object('id',result,'specific',true);
end $$;
revoke all on function public.save_catalog_product(text,uuid,text,text,numeric,text,text,uuid,boolean) from public,anon;
grant execute on function public.save_catalog_product(text,uuid,text,text,numeric,text,text,uuid,boolean) to authenticated;
