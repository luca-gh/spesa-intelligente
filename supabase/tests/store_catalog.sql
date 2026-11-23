-- Synthetic records and roles only. The entire probe is rolled back.
begin;
set local statement_timeout='30s';
create temporary table store_catalog_context(key text primary key,value uuid not null) on commit drop;
grant select,insert on store_catalog_context to authenticated;
insert into store_catalog_context values('alice',gen_random_uuid()),('eve',gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at)
  select value,'authenticated','authenticated','store-catalog-'||value||'@example.invalid',now(),now() from store_catalog_context;
select set_config('request.jwt.claim.sub',(select value::text from store_catalog_context where key='alice'),true);
set local role authenticated;
do $$
declare h uuid; other uuid; first_store uuid; second_store uuid; other_store uuid; fruit uuid; dairy uuid;
  ids uuid[]; expected jsonb; before_order jsonb; product uuid; food uuid; price uuid; corrected uuid; l uuid; item uuid; count_before integer;
begin
  h:=public.create_household('Fixture catalogo e corsie');
  l:=public.ensure_shopping_list(h);
  insert into public.stores(household_id,name) values(h,'Primo') returning id into first_store;
  insert into public.categories(household_id,name,sort_order) values(h,'Frutta',10) returning id into fruit;
  insert into public.categories(household_id,name,sort_order) values(h,'Latticini',20) returning id into dairy;
  insert into public.stores(household_id,name) values(h,'Secondo') returning id into second_store;
  if (select count(*) from public.store_category_order where household_id=h) <> 6 then raise exception 'Category replication failed'; end if;
  select jsonb_object_agg(category_id::text,sort_order) into before_order from public.store_category_order where store_id=second_store;
  select array_agg(category_id order by category_id),jsonb_object_agg(category_id::text,sort_order) into ids,expected from public.store_category_order where store_id=first_store;
  perform public.reorder_store_categories(first_store,array(select x from unnest(ids) x order by x=fruit desc,x),expected);
  if (select sort_order from public.store_category_order where store_id=first_store and category_id=fruit)<>0 then raise exception 'Store order not saved'; end if;
  if before_order is distinct from (select jsonb_object_agg(category_id::text,sort_order) from public.store_category_order where store_id=second_store) then raise exception 'Other store order changed'; end if;
  begin
    perform public.reorder_store_categories(first_store,array[fruit,fruit],expected);
    raise exception 'Incomplete/stale order accepted';
  exception when raise_exception then if sqlerrm not like 'Conflitto:%' then raise; end if; end;

  product:=(public.save_catalog_product('Latte fixture',dairy,'Marca',p_quantity:=500,p_unit:='ml')->>'id')::uuid;
  select generic_product_id into food from public.specific_products where id=product;
  item:=public.add_shopping_product(l,'Latte fixture',1,'conf',food,null,'Marca',null,null);
  if (select preferred_brand from public.shopping_list_items where id=item) <> 'Marca' or
     (select specific_product_id from public.shopping_list_items where id=item) is not null then raise exception 'Brand wrongly pins a format'; end if;
  item:=public.add_shopping_product(l,'Latte fixture',500,'ml',food,null,null,500,'ml');
  if (select preferred_package_quantity from public.shopping_list_items where id=item)<>500 or
     (select preferred_brand from public.shopping_list_items where id=item) is not null then raise exception 'Format wrongly pins a brand'; end if;
  select count(*) into count_before from public.shopping_list_items where list_id=l;
  begin
    perform public.add_shopping_product(l,'Invalid format',1,'conf',food,null,null,500,null);
    raise exception 'Incomplete preference accepted';
  exception when check_violation then null; end;
  if (select count(*) from public.shopping_list_items where list_id=l)<>count_before then raise exception 'Partial item survived failed transaction'; end if;

  price:=public.add_price(product,first_store,2.5,'regular',now());
  begin
    perform public.correct_catalog_price(price,-1,'regular',now());
    raise exception 'Negative correction accepted';
  exception when check_violation then null; end;
  if (select voided_at from public.price_observations where id=price) is not null then raise exception 'Failed correction voided original'; end if;
  corrected:=public.correct_catalog_price(price,2.75,'regular',now());
  if (select voided_at from public.price_observations where id=price) is null or
     (select price_amount from public.price_observations where id=corrected)<>2.75 then raise exception 'Correction/history invalid'; end if;
  begin
    perform public.correct_catalog_price(price,3,'regular',now());
    raise exception 'Stale correction accepted';
  exception when raise_exception then if sqlerrm not like 'Conflitto:%' then raise; end if; end;

  perform set_config('request.jwt.claim.sub',(select value::text from store_catalog_context where key='eve'),true);
  other:=public.create_household('Fixture estranea');
  insert into public.stores(household_id,name) values(other,'Estraneo') returning id into other_store;
  if exists(select 1 from public.store_category_order where household_id=h) then raise exception 'Cross-household order visible'; end if;
  begin
    perform public.reorder_store_categories(first_store,ids,expected);
    raise exception 'Cross-household reorder allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.correct_catalog_price(corrected,1,'regular',now());
    raise exception 'Cross-household correction allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.add_shopping_product(l,'Intrusion',1,'conf');
    raise exception 'Cross-household list write allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.store_category_order(household_id,store_id,category_id) values(other,other_store,fruit);
    raise exception 'Cross-household FK allowed';
  exception when foreign_key_violation then null; end;
  perform set_config('request.jwt.claim.sub',(select value::text from store_catalog_context where key='alice'),true);
  perform public.delete_category(fruit);
  if exists(select 1 from public.store_category_order where category_id=fruit) then raise exception 'Category order orphan'; end if;
  delete from public.stores where id=second_store;
  if exists(select 1 from public.store_category_order where store_id=second_store) then raise exception 'Store order orphan'; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.reorder_store_categories(uuid,uuid[],jsonb)','execute') or
     has_function_privilege('anon','public.correct_catalog_price(uuid,numeric,text,timestamptz,date,date)','execute') or
     has_function_privilege('anon','private.correct_catalog_price(uuid,numeric,text,timestamptz,date,date)','execute') or
     has_function_privilege('anon','public.add_shopping_product(uuid,text,numeric,text,uuid,uuid,text,numeric,text)','execute') or
     has_table_privilege('anon','public.store_category_order','select') then raise exception 'Anonymous grant exposed'; end if;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in('reorder_store_categories','correct_catalog_price','add_shopping_product') and prosecdef) then raise exception 'Public definer exposed'; end if;
end $$;
rollback;
select 'PASS' as status,'Store order, preferences, price corrections, isolation and rollback verified' as verification;
