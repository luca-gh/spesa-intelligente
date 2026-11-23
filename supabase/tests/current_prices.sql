begin;
set local statement_timeout='30s';
create temporary table current_price_context(key text primary key,value uuid not null) on commit drop;
grant select,insert on current_price_context to authenticated;
insert into current_price_context values('alice',gen_random_uuid()),('eve',gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at)
  select value,'authenticated','authenticated','current-price-'||value||'@example.invalid',now(),now() from current_price_context;
select set_config('request.jwt.claim.sub',(select value::text from current_price_context where key='alice'),true);
set local role authenticated;
do $$
declare h uuid; other uuid; product uuid; store uuid; second_store uuid; foreign_store uuid;
begin
  h:=public.create_household('Fixture prezzi attuali');
  insert into public.stores(household_id,name) values(h,'Primo') returning id into store;
  insert into public.stores(household_id,name) values(h,'Secondo') returning id into second_store;
  product:=(public.save_catalog_product('Latte fixture',p_quantity:=500,p_unit:='ml')->>'id')::uuid;
  perform public.set_product_price(product,store,2.5);
  perform public.set_product_price(product,second_store,3);
  perform public.set_product_price(product,store,1.2);
  if (select count(*) from public.product_prices where specific_product_id=product)<>2 or
    (select price_amount from public.product_prices where specific_product_id=product and store_id=store)<>1.2 then raise exception 'Update did not replace current price'; end if;
  if exists(select 1 from public.price_observations where specific_product_id=product) then raise exception 'Price history was created'; end if;
  begin
    perform public.set_product_price(product,store,-1);
    raise exception 'Negative price accepted';
  exception when raise_exception then if sqlerrm not like 'Prezzo non valido:%' then raise; end if; end;
  if (select price_amount from public.product_prices where specific_product_id=product and store_id=store)<>1.2 then raise exception 'Invalid update changed price'; end if;
  perform public.clear_product_price(product,store);
  if exists(select 1 from public.product_prices where specific_product_id=product and store_id=store) then raise exception 'Deleted price reappeared'; end if;
  perform public.set_product_price(product,store,0);

  perform set_config('request.jwt.claim.sub',(select value::text from current_price_context where key='eve'),true);
  other:=public.create_household('Altra famiglia fixture');
  insert into public.stores(household_id,name) values(other,'Negozio estraneo') returning id into foreign_store;
  if exists(select 1 from public.product_prices where household_id=h) then raise exception 'Cross-family read'; end if;
  begin
    perform public.set_product_price(product,store,9);
    raise exception 'Cross-family update allowed';
  exception when insufficient_privilege then null; end;
  perform public.clear_product_price(product,store);
  begin
    insert into public.product_prices(household_id,specific_product_id,store_id,price_amount) values(other,product,foreign_store,8);
    raise exception 'Cross-family FK allowed';
  exception when foreign_key_violation then null; end;
  perform set_config('request.jwt.claim.sub',(select value::text from current_price_context where key='alice'),true);
  if (select price_amount from public.product_prices where specific_product_id=product and store_id=store)<>0 then raise exception 'Cross-family clear affected price'; end if;
  perform public.delete_catalog_product(product,true);
  if exists(select 1 from public.product_prices where specific_product_id=product) then raise exception 'Orphan current price'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.product_prices','select') or
    has_function_privilege('anon','public.set_product_price(uuid,uuid,numeric)','execute') or
    has_function_privilege('anon','public.clear_product_price(uuid,uuid)','execute') then raise exception 'Anonymous access exposed'; end if;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in('set_product_price','clear_product_price') and prosecdef) then raise exception 'Public definer exposed'; end if;
end $$;
rollback;
select 'PASS' as status,'Current prices replace values, no history, isolation and rollback verified' as verification;
