-- Existing amounts stay regular prices; no discount is inferred or backfilled.
alter table public.product_prices alter column price_amount drop not null;
alter table public.product_prices add column discounted_price_amount numeric(14,2)
  check(discounted_price_amount>=0 and discounted_price_amount<>'NaN'::numeric);
alter table public.product_prices add constraint product_prices_has_amount
  check(price_amount is not null or discounted_price_amount is not null);

create function public.set_product_prices(p_product uuid,p_store uuid,p_amount numeric,p_discounted numeric,p_basis text)
returns void language plpgsql security invoker set search_path='' as $$
declare h uuid;
begin
  select household_id into h from public.specific_products where id=p_product and archived_at is null for update;
  if auth.uid() is null or h is null or not private.is_member(h) or not exists(select 1 from public.stores where id=p_store and household_id=h and archived_at is null) then
    raise exception 'Accesso negato' using errcode='42501';
  end if;
  if (p_amount is not null and (p_amount<0 or p_amount::text in ('NaN','Infinity','-Infinity'))) or
     (p_discounted is not null and (p_discounted<0 or p_discounted::text in ('NaN','Infinity','-Infinity'))) or
     p_basis is null or p_basis not in ('package','kg','l') then
    raise exception 'Prezzo non valido: controlla importi e tipo di prezzo.';
  end if;
  if p_amount is null and p_discounted is null then
    delete from public.product_prices where specific_product_id=p_product and store_id=p_store;
    return;
  end if;
  insert into public.product_prices(household_id,specific_product_id,store_id,price_amount,discounted_price_amount,price_basis)
    values(h,p_product,p_store,p_amount,p_discounted,p_basis)
    on conflict(specific_product_id,store_id) do update set price_amount=excluded.price_amount,
      discounted_price_amount=excluded.discounted_price_amount,price_basis=excluded.price_basis,updated_at=now();
end $$;
revoke all on function public.set_product_prices(uuid,uuid,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.set_product_prices(uuid,uuid,numeric,numeric,text) to authenticated;

-- The old remove action removes only the regular price, preserving a separately entered discount.
create or replace function public.clear_product_price(p_product uuid,p_store uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  delete from public.product_prices where specific_product_id=p_product and store_id=p_store and discounted_price_amount is null;
  update public.product_prices set price_amount=null,updated_at=now()
    where specific_product_id=p_product and store_id=p_store and discounted_price_amount is not null;
end $$;

create function public.create_catalog_product_with_prices(p_product jsonb,p_store uuid,p_amount numeric,p_discounted numeric,p_basis text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved jsonb;
begin
  if jsonb_typeof(p_product) is distinct from 'object' or p_store is null or (p_amount is null and p_discounted is null) then raise exception 'Prezzo non valido: completa supermercato e almeno un importo.'; end if;
  saved:=public.save_catalog_product(
    p_name:=p_product->>'p_name',p_category:=(p_product->>'p_category')::uuid,
    p_brand:=coalesce(p_product->>'p_brand',''),p_barcode:=p_product->>'p_barcode',
    p_quantity:=(p_product->>'p_quantity')::numeric,p_unit:=p_product->>'p_unit',p_variant:=coalesce(p_product->>'p_variant',''));
  perform public.set_product_prices((saved->>'id')::uuid,p_store,p_amount,p_discounted,p_basis);
  return saved;
end $$;
revoke all on function public.create_catalog_product_with_prices(jsonb,uuid,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.create_catalog_product_with_prices(jsonb,uuid,numeric,numeric,text) to authenticated;

create function public.clear_discounted_product_price(p_product uuid,p_store uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  delete from public.product_prices where specific_product_id=p_product and store_id=p_store and price_amount is null;
  update public.product_prices set discounted_price_amount=null,updated_at=now()
    where specific_product_id=p_product and store_id=p_store and price_amount is not null;
end $$;
revoke all on function public.clear_discounted_product_price(uuid,uuid) from public,anon,authenticated;
grant execute on function public.clear_discounted_product_price(uuid,uuid) to authenticated;

create or replace function public.set_product_price_basis(p_product uuid,p_store uuid,p_amount numeric,p_basis text)
returns void language plpgsql security invoker set search_path='' as $$
declare h uuid;
begin
  select household_id into h from public.specific_products where id=p_product and archived_at is null for update;
  if auth.uid() is null or h is null or not private.is_member(h) or not exists(select 1 from public.stores where id=p_store and household_id=h and archived_at is null) then
    raise exception 'Accesso negato' using errcode='42501';
  end if;
  if p_amount is null or p_amount<0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_basis is null or p_basis not in ('package','kg','l') then
    raise exception 'Prezzo non valido: controlla importo e tipo di prezzo.';
  end if;
  if exists(select 1 from public.product_prices where specific_product_id=p_product and store_id=p_store and discounted_price_amount is not null and price_basis<>p_basis) then
    raise exception 'Prezzo non valido: modifica insieme prezzo e prezzo scontato quando cambi il tipo di prezzo.';
  end if;
  insert into public.product_prices(household_id,specific_product_id,store_id,price_amount,price_basis)
    values(h,p_product,p_store,p_amount,p_basis)
    on conflict(specific_product_id,store_id) do update set price_amount=excluded.price_amount,price_basis=excluded.price_basis,updated_at=now();
end $$;
revoke all on function public.set_product_price_basis(uuid,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.set_product_price_basis(uuid,uuid,numeric,text) to authenticated;

