alter table public.product_prices add column price_basis text not null default 'package'
  check(price_basis in ('package','kg','l'));
alter table public.product_prices add constraint product_prices_finite check(price_amount<>'NaN'::numeric);

create function private.check_product_price_basis() returns trigger language plpgsql security invoker set search_path='' as $$
declare u text;
begin
  select package_unit into u from public.specific_products where id=new.specific_product_id and household_id=new.household_id;
  if u is not null and ((new.price_basis='kg' and u not in ('g','kg')) or (new.price_basis='l' and u not in ('ml','L'))) then
    raise exception 'Prezzo non valido: scegli un tipo di prezzo compatibile con il formato del prodotto.';
  end if;
  return new;
end $$;
revoke all on function private.check_product_price_basis() from public,anon,authenticated;
create trigger check_product_price_basis before insert or update on public.product_prices for each row execute function private.check_product_price_basis();

create function private.check_product_format_prices() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.package_unit is not null and exists(select 1 from public.product_prices p where p.specific_product_id=new.id and p.household_id=new.household_id and
    ((p.price_basis='kg' and new.package_unit not in ('g','kg')) or (p.price_basis='l' and new.package_unit not in ('ml','L')))) then
    raise exception 'Prezzo non valido: aggiorna o rimuovi i prezzi al kg/l prima di cambiare il tipo di formato.';
  end if;
  return new;
end $$;
revoke all on function private.check_product_format_prices() from public,anon,authenticated;
create trigger check_product_format_prices before update of package_unit on public.specific_products for each row execute function private.check_product_format_prices();

create function public.set_product_price_basis(p_product uuid,p_store uuid,p_amount numeric,p_basis text)
returns void language plpgsql security invoker set search_path='' as $$
declare h uuid;
begin
  select household_id into h from public.specific_products where id=p_product and archived_at is null;
  if auth.uid() is null or h is null or not private.is_member(h) or not exists(select 1 from public.stores where id=p_store and household_id=h and archived_at is null) then
    raise exception 'Accesso negato' using errcode='42501';
  end if;
  if p_amount is null or p_amount<0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_basis is null or p_basis not in ('package','kg','l') then
    raise exception 'Prezzo non valido: controlla importo e tipo di prezzo.';
  end if;
  insert into public.product_prices(household_id,specific_product_id,store_id,price_amount,price_basis)
    values(h,p_product,p_store,p_amount,p_basis)
    on conflict(specific_product_id,store_id) do update set price_amount=excluded.price_amount,price_basis=excluded.price_basis,updated_at=now();
end $$;
revoke all on function public.set_product_price_basis(uuid,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.set_product_price_basis(uuid,uuid,numeric,text) to authenticated;

-- Preserve the existing API: old clients still explicitly write a product/package price.
create or replace function public.set_product_price(p_product uuid,p_store uuid,p_amount numeric)
returns void language sql security invoker set search_path='' as $$
  select public.set_product_price_basis(p_product,p_store,p_amount,'package');
$$;

create function public.create_catalog_product_with_price(p_product jsonb,p_store uuid,p_amount numeric,p_basis text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved jsonb;
begin
  if jsonb_typeof(p_product) is distinct from 'object' or p_store is null or p_amount is null then raise exception 'Prezzo non valido: completa supermercato e importo.'; end if;
  saved:=public.save_catalog_product(
    p_name:=p_product->>'p_name',p_category:=(p_product->>'p_category')::uuid,
    p_brand:=coalesce(p_product->>'p_brand',''),p_barcode:=p_product->>'p_barcode',
    p_quantity:=(p_product->>'p_quantity')::numeric,p_unit:=p_product->>'p_unit',p_variant:=coalesce(p_product->>'p_variant',''));
  perform public.set_product_price_basis((saved->>'id')::uuid,p_store,p_amount,p_basis);
  return saved;
end $$;
revoke all on function public.create_catalog_product_with_price(jsonb,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.create_catalog_product_with_price(jsonb,uuid,numeric,text) to authenticated;
