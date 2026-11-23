-- One current amount per product/store. No promotion periods or price-event history.
create table public.product_prices (
  household_id uuid not null references public.households(id) on delete cascade,
  specific_product_id uuid not null,
  store_id uuid not null,
  price_amount numeric(14,2) not null check(price_amount >= 0),
  updated_at timestamptz not null default now(),
  primary key(specific_product_id,store_id),
  foreign key(specific_product_id,household_id) references public.specific_products(id,household_id) on delete cascade,
  foreign key(store_id,household_id) references public.stores(id,household_id) on delete cascade
);
create index product_prices_household on public.product_prices(household_id);
create index product_prices_product_household on public.product_prices(specific_product_id,household_id);
create index product_prices_store_household on public.product_prices(store_id,household_id);
alter table public.product_prices enable row level security;
revoke all on public.product_prices from public,anon,authenticated;
grant select,insert,update,delete on public.product_prices to authenticated;
create policy member_access on public.product_prices for all to authenticated
  using(private.is_member(household_id)) with check(private.is_member(household_id));

-- Keep the last available amount, regardless of the former price classification.
insert into public.product_prices(household_id,specific_product_id,store_id,price_amount,updated_at)
select distinct on(specific_product_id,store_id) household_id,specific_product_id,store_id,price_amount,observed_at
from public.price_observations where voided_at is null
order by specific_product_id,store_id,observed_at desc,id desc;

create function public.set_product_price(p_product uuid,p_store uuid,p_amount numeric) returns void
language plpgsql security invoker set search_path='' as $$
declare h uuid; begin
  select household_id into h from public.specific_products where id=p_product and archived_at is null;
  if h is null or not private.is_member(h) or not exists(
    select 1 from public.stores where id=p_store and household_id=h and archived_at is null
  ) then raise exception 'Accesso negato' using errcode='42501'; end if;
  if p_amount is null or p_amount<0 then raise exception 'Prezzo non valido: inserisci un importo maggiore o uguale a zero.'; end if;
  insert into public.product_prices(household_id,specific_product_id,store_id,price_amount)
    values(h,p_product,p_store,p_amount)
    on conflict(specific_product_id,store_id) do update set price_amount=excluded.price_amount,updated_at=now();
end $$;
revoke all on function public.set_product_price(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.set_product_price(uuid,uuid,numeric) to authenticated;

create function public.clear_product_price(p_product uuid,p_store uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  delete from public.product_prices where specific_product_id=p_product and store_id=p_store;
end $$;
revoke all on function public.clear_product_price(uuid,uuid) from public,anon,authenticated;
grant execute on function public.clear_product_price(uuid,uuid) to authenticated;
alter publication supabase_realtime add table public.product_prices;
