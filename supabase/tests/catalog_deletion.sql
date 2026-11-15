-- Synthetic households only; never delete existing family products. Always roll back.
begin;
set local statement_timeout='30s';
create temporary table catalog_delete_context(key text primary key,value uuid not null) on commit drop;
grant select,insert on catalog_delete_context to authenticated;
insert into catalog_delete_context values('alice',gen_random_uuid()),('bob',gen_random_uuid()),('eve',gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at)
select value,'authenticated','authenticated','catalog-delete-'||value||'@example.invalid',now(),now() from catalog_delete_context;
select set_config('request.jwt.claim.sub',(select value::text from catalog_delete_context where key='alice'),true);
set local role authenticated;
do $$
declare
  h uuid; other uuid; l uuid; store uuid; category uuid; product uuid; food uuid; keep uuid; keep_food uuid;
  item uuid; hidden uuid; plain uuid; free_item uuid; purchase uuid; recipe uuid; plan uuid; template uuid;
  snapshot uuid; safe_snapshot uuid; rule uuid; sibling uuid; brand_id uuid; shared_food uuid;
  meal uuid; shared_recipe uuid; shared_item uuid; legacy uuid; child uuid; isolated uuid;
  version_before integer; plan_before integer; invite text; result jsonb;
begin
  h:=public.create_household('Fixture cancellazione catalogo');
  l:=public.ensure_shopping_list(h);
  insert into catalog_delete_context values('home',h);
  insert into public.stores(household_id,name) values(h,'Negozio fixture') returning id into store;
  insert into public.categories(household_id,name) values(h,'Categoria fixture') returning id into category;
  result:=public.save_catalog_product('Prodotto da eliminare',category,'Marca fixture',p_quantity:=1,p_unit:='L');
  product:=(result->>'id')::uuid;
  select generic_product_id into food from public.specific_products where id=product;
  keep:=(public.save_catalog_product('Prodotto conservato',category,p_quantity:=1,p_unit:='L')->>'id')::uuid;
  select generic_product_id into keep_food from public.specific_products where id=keep;
  item:=public.add_list_item(l,'Generico collegato',2,'L',food);
  hidden:=public.add_list_item(l,'Specifico già rimosso',2,'L',p_specific:=product);
  free_item:=public.add_list_item(l,'Articolo libero con acquisto della marca',2,'L');
  plain:=public.add_list_item(l,'Articolo estraneo',2,'L',keep_food);
  purchase:=public.record_purchase(gen_random_uuid(),item,1,2,store,product);
  perform public.record_purchase(gen_random_uuid(),hidden,1,3,store,product);
  perform public.record_purchase(gen_random_uuid(),free_item,1,4,store,product);
  perform public.record_purchase(gen_random_uuid(),plain,1,5,store,keep);
  perform public.add_price(product,store,2,'regular',now());
  perform public.void_price(public.add_price(product,store,3,'promotion',now()));
  perform public.add_price(keep,store,5,'regular',now());
  select version into version_before from public.shopping_lists where id=l;
  perform public.set_record_archived('shopping_list_items',hidden,true,version_before);
  perform public.set_record_archived('specific_products',product,true);
  recipe:=public.save_recipe('Ricetta conservata',2,'Procedimento',null,jsonb_build_array(
    jsonb_build_object('product_id',food,'quantity',1,'unit','L'),
    jsonb_build_object('product_id',keep_food,'quantity',2,'unit','L')));
  insert into public.meal_plans(household_id,week_start) values(h,'2026-11-16') returning id into plan;
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,generic_product_id,quantity,unit)
    values(h,plan,'2026-11-16','pranzo',food,1,'L');
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id)
    values(h,plan,'2026-11-16','cena',recipe);
  insert into public.meal_templates(household_id,name,entries_json) values(h,'Modello conservato',jsonb_build_array(
    jsonb_build_object('generic_product_id',keep_food,'marker',1),
    jsonb_build_object('generic_product_id',food,'marker',2),
    jsonb_build_object('recipe_id',recipe,'generic_product_id',null,'marker',3),
    jsonb_build_object('generic_product_id','invalid-but-unrelated','marker',4))) returning id into template;
  insert into public.store_discount_rules(household_id,store_id,name,percentage,weekdays,valid_from,excluded_product_ids)
    values(h,store,'Regola conservata',10,array[1],current_date,array[keep,product,food]) returning id into rule;
  snapshot:=public.save_estimate(l,store,2,1,current_date,jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('productId',product))));
  perform public.save_estimate(l,store,2,1,current_date,jsonb_build_object('nested',jsonb_build_object('itemId',hidden)));
  safe_snapshot:=public.save_estimate(l,store,5,1,current_date,jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('productId',keep,'itemId',plain))));
  select version into version_before from public.shopping_lists where id=l;
  select version into plan_before from public.meal_plans where id=plan;

  -- Foreign member cannot delete an existing target, even through the private implementation.
  perform set_config('request.jwt.claim.sub',(select value::text from catalog_delete_context where key='eve'),true);
  other:=public.create_household('Altra famiglia fixture');
  isolated:=(public.save_catalog_product('Altro prodotto')->>'id')::uuid;
  begin
    perform public.delete_catalog_product(product,true);
    raise exception 'Cross-family deletion accepted';
  exception when raise_exception then if SQLERRM<>'Accesso negato' then raise; end if; end;
  begin
    perform private.delete_catalog_product(food,false);
    raise exception 'Private cross-family deletion accepted';
  exception when raise_exception then if SQLERRM<>'Accesso negato' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',(select value::text from catalog_delete_context where key='alice'),true);
  if not exists(select 1 from public.specific_products where id=product) then raise exception 'Cross-family changed target'; end if;

  -- Another actual member can perform the operation. No real accounts or email are involved.
  invite:=public.create_invite(h);
  perform set_config('request.jwt.claim.sub',(select value::text from catalog_delete_context where key='bob'),true);
  perform public.accept_invite(invite);
  perform public.delete_catalog_product(product,true);
  if exists(select 1 from public.specific_products where id=product) or exists(select 1 from public.generic_products where id=food)
    or exists(select 1 from public.shopping_list_items where id in(item,hidden))
    or exists(select 1 from public.list_item_contributions where item_id in(item,hidden))
    or exists(select 1 from public.purchases where id=purchase or specific_product_id=product or list_item_id in(item,hidden))
    or exists(select 1 from public.price_observations where specific_product_id=product)
    or exists(select 1 from public.recipe_ingredients where generic_product_id=food)
    or exists(select 1 from public.meal_entries where generic_product_id=food)
    or exists(select 1 from public.price_estimate_snapshots where id=snapshot)
    then raise exception 'Linked records survived deletion'; end if;
  if (select count(*) from public.price_estimate_snapshots where household_id=h)<>1
    or not exists(select 1 from public.price_estimate_snapshots where id=safe_snapshot)
    then raise exception 'Estimate cleanup is not selective'; end if;
  if (select entries_json from public.meal_templates where id=template) <> jsonb_build_array(
    jsonb_build_object('generic_product_id',keep_food,'marker',1),
    jsonb_build_object('recipe_id',recipe,'generic_product_id',null,'marker',3),
    jsonb_build_object('generic_product_id','invalid-but-unrelated','marker',4))
    then raise exception 'Template cleanup changed other entries or order'; end if;
  if (select excluded_product_ids from public.store_discount_rules where id=rule)<>array[keep]
    then raise exception 'Discount exclusions not cleaned'; end if;
  if not exists(select 1 from public.specific_products where id=keep)
    or not exists(select 1 from public.stores where id=store) or not exists(select 1 from public.categories where id=category)
    or not exists(select 1 from public.shopping_list_items where id=plain)
    or not exists(select 1 from public.shopping_list_items where id=free_item)
    or not exists(select 1 from public.purchases where list_item_id=plain and total_paid=5)
    or not exists(select 1 from public.price_observations where specific_product_id=keep)
    or not exists(select 1 from public.recipes where id=recipe)
    or (select count(*) from public.recipe_ingredients where recipe_id=recipe)<>1
    or not exists(select 1 from public.meal_entries where recipe_id=recipe)
    then raise exception 'Unrelated data deleted'; end if;
  if (select version from public.shopping_lists where id=l)<=version_before or (select version from public.meal_plans where id=plan)<=plan_before
    then raise exception 'Stale previews not invalidated'; end if;
  begin
    perform public.apply_plan_diff(l,plan,version_before,'[]',plan_before);
    raise exception 'Stale preview accepted';
  exception when raise_exception then if SQLERRM not like 'Lista modificata:%' then raise; end if; end;

  -- Shared generic food stays usable when a distinct brand/variant still exists, even archived.
  brand_id:=(public.save_catalog_product('Alimento condiviso',p_brand:='Marca A',p_quantity:=1,p_unit:='L')->>'id')::uuid;
  sibling:=(public.save_catalog_product('Alimento condiviso',p_brand:='Marca B',p_quantity:=1,p_unit:='L')->>'id')::uuid;
  select generic_product_id into shared_food from public.specific_products where id=brand_id;
  shared_item:=public.add_list_item(l,'Alimento condiviso',2,'L',shared_food);
  perform public.record_purchase(gen_random_uuid(),shared_item,1,2,store,brand_id);
  perform public.record_purchase(gen_random_uuid(),shared_item,1,3,store,sibling);
  shared_recipe:=public.save_recipe('Ricetta condivisa',2,'',null,jsonb_build_array(jsonb_build_object('product_id',shared_food,'quantity',1,'unit','L')));
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,generic_product_id,quantity,unit)
    values(h,plan,'2026-11-17','pranzo',shared_food,1,'L') returning id into meal;
  perform public.set_record_archived('specific_products',sibling,true);
  perform public.delete_catalog_product(brand_id,true);
  if not exists(select 1 from public.specific_products where id=sibling)
    or not exists(select 1 from public.shopping_list_items where id=shared_item)
    or not exists(select 1 from public.recipe_ingredients where recipe_id=shared_recipe)
    or not exists(select 1 from public.meal_entries where id=meal)
    or not exists(select 1 from public.purchases where specific_product_id=sibling)
    or exists(select 1 from public.purchases where specific_product_id=brand_id)
    then raise exception 'Shared food or other brand changed'; end if;
  perform public.delete_catalog_product(sibling,true);
  if exists(select 1 from public.generic_products where id=shared_food)
    or exists(select 1 from public.meal_entries where id=meal)
    or exists(select 1 from public.shopping_list_items where id=shared_item)
    or exists(select 1 from public.recipe_ingredients where recipe_id=shared_recipe)
    then raise exception 'Last brand did not clean up shared food'; end if;

  -- Legacy plain products, legacy groups and ungrouped cards are also removable.
  insert into public.generic_products(household_id,name) values(h,'Prodotto legacy') returning id into legacy;
  insert into public.specific_products(household_id,generic_product_id,name) values(h,legacy,'Scheda legacy') returning id into child;
  perform public.add_price(child,store,1,'regular',now());
  perform public.delete_catalog_product(legacy,false);
  if exists(select 1 from public.specific_products where id=child) or exists(select 1 from public.price_observations where specific_product_id=child)
    then raise exception 'Legacy children survived'; end if;
  insert into public.generic_products(household_id,name) values(h,'Solo generico') returning id into legacy;
  perform public.delete_catalog_product(legacy,false);
  insert into public.specific_products(household_id,name) values(h,'Senza gruppo') returning id into child;
  perform public.delete_catalog_product(child,true);
  if exists(select 1 from public.generic_products where id=legacy) or exists(select 1 from public.specific_products where id=child)
    then raise exception 'Plain or ungrouped product survived'; end if;
  begin
    perform public.delete_catalog_product(keep,null);
    raise exception 'Null mode accepted';
  exception when raise_exception then if SQLERRM<>'Accesso negato' then raise; end if; end;
  result:=public.save_catalog_product('Prodotto da eliminare',category,'Marca fixture');
  if (result->>'id')::uuid=product then raise exception 'Recreated product reused deleted identity'; end if;
  perform set_config('request.jwt.claim.sub',(select value::text from catalog_delete_context where key='eve'),true);
  if not exists(select 1 from public.specific_products where id=isolated) then raise exception 'Other household modified'; end if;
end $$;
reset role;
do $$ begin
  if (select prosecdef from pg_proc where oid='public.delete_catalog_product(uuid,boolean)'::regprocedure)
    or not (select prosecdef from pg_proc where oid='private.delete_catalog_product(uuid,boolean)'::regprocedure)
    then raise exception 'Wrong function security mode'; end if;
  if has_function_privilege('anon','public.delete_catalog_product(uuid,boolean)','execute')
    or has_function_privilege('anon','private.delete_catalog_product(uuid,boolean)','execute')
    or has_table_privilege('authenticated','public.purchases','delete')
    or has_table_privilege('authenticated','public.price_observations','delete')
    then raise exception 'Excessive privileges'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.delete_catalog_product('00000000-0000-4000-8000-000000000000',true);
    raise exception 'Anonymous deletion accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS' as status,'Catalog deletion: links, history, shared brands, isolation and rollback verified' as verification;
