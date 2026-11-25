begin;
set local statement_timeout='30s';
create temporary table discount_context(id uuid) on commit drop;
insert into discount_context values(gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at) select id,'authenticated','authenticated','discount-'||id||'@example.invalid',now(),now() from discount_context;
select set_config('request.jwt.claim.sub',(select id::text from discount_context),true);
set local role authenticated;
do $$
declare h uuid; s uuid; p uuid; n integer;
begin
 h:=public.create_household('Fixture doppio prezzo');
 insert into public.stores(household_id,name) values(h,'Fixture negozio') returning id into s;
 p:=(public.save_catalog_product('Fixture prodotto',p_quantity:=6,p_unit:='pz')->>'id')::uuid;
 perform public.set_product_price(p,s,3);
 if not exists(select 1 from public.product_prices where specific_product_id=p and price_amount=3 and discounted_price_amount is null) then raise exception 'Legacy price reclassified'; end if;
 perform public.set_product_prices(p,s,3,2.4,'package');
 perform public.set_product_price(p,s,4);
 if not exists(select 1 from public.product_prices where specific_product_id=p and price_amount=4 and discounted_price_amount=2.4) then raise exception 'Legacy write destroyed discount'; end if;
 perform public.clear_product_price(p,s);
 if not exists(select 1 from public.product_prices where specific_product_id=p and price_amount is null and discounted_price_amount=2.4) then raise exception 'Regular clear destroyed discount'; end if;
 perform public.set_product_prices(p,s,3,0,'package');
 perform public.clear_discounted_product_price(p,s);
 if not exists(select 1 from public.product_prices where specific_product_id=p and price_amount=3 and discounted_price_amount is null) then raise exception 'Discount clear destroyed regular'; end if;
 begin
  perform public.set_product_prices(p,s,9,-1,'package');
  raise exception 'Negative discount accepted';
 exception when raise_exception then if sqlerrm not like 'Prezzo non valido:%' then raise; end if; end;
 if not exists(select 1 from public.product_prices where specific_product_id=p and price_amount=3 and discounted_price_amount is null) then raise exception 'Partial pair update'; end if;
 begin
  perform public.set_product_prices(p,s,3,'NaN'::numeric,'package');
  raise exception 'NaN discount accepted';
 exception when raise_exception then if sqlerrm not like 'Prezzo non valido:%' then raise; end if; end;
 n:=(select count(*) from public.specific_products);
 begin
  perform public.create_catalog_product_with_prices('{"p_name":"Rollback doppio prezzo"}',gen_random_uuid(),3,2,'package');
  raise exception 'Invalid store accepted';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.specific_products)<>n then raise exception 'Partial product persisted'; end if;
 p:=(public.create_catalog_product_with_prices('{"p_name":"Sfuso fixture"}',s,null,15,'kg')->>'id')::uuid;
 if not exists(select 1 from public.product_prices where specific_product_id=p and price_amount is null and discounted_price_amount=15 and price_basis='kg') then raise exception 'Discount only creation failed'; end if;
 begin
  perform public.set_product_price(p,s,3);
  raise exception 'Legacy basis changed discount';
 exception when raise_exception then if sqlerrm not like 'Prezzo non valido:%' then raise; end if; end;
 if exists(select 1 from public.price_observations where specific_product_id=p) then raise exception 'Price history created'; end if;
 perform public.set_product_prices(p,s,null,null,'kg');
 if exists(select 1 from public.product_prices where specific_product_id=p) then raise exception 'Empty pair persisted'; end if;
 perform public.set_product_prices(p,s,20,15,'kg');
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin
  perform public.set_product_prices(p,s,1,0,'kg');
  raise exception 'Foreign write allowed';
 exception when insufficient_privilege then null; end;
 perform public.clear_product_price(p,s);
 perform public.clear_discounted_product_price(p,s);
 if exists(select 1 from public.product_prices where specific_product_id=p) then raise exception 'Foreign read allowed'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.product_prices where price_amount=20 and discounted_price_amount=15) then raise exception 'Foreign clear changed prices'; end if;
 if exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('set_product_prices','create_catalog_product_with_prices','clear_discounted_product_price') and (p.prosecdef or has_function_privilege('anon',p.oid,'execute'))) then raise exception 'Unsafe public RPC'; end if;
end $$;
rollback;
select 'PASS' as status,'Independent prices, missing values, legacy preservation, atomicity and isolation verified' as verification;
