begin;
set local statement_timeout='30s';
create temporary table alternative_context(key text primary key,value uuid not null) on commit drop;
grant select,insert on alternative_context to authenticated;
insert into alternative_context values('alice',gen_random_uuid()),('eve',gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at)
  select value,'authenticated','authenticated','alternatives-'||value||'@example.invalid',now(),now() from alternative_context;
select set_config('request.jwt.claim.sub',(select value::text from alternative_context where key='alice'),true);
set local role authenticated;
do $$
declare h uuid; h2 uuid; penne uuid; fusilli uuid; sauce uuid; r uuid; copied uuid; ingredient uuid; alt uuid; l uuid; op uuid:=gen_random_uuid(); s uuid; plan uuid; version_before integer;
begin
  h:=public.create_household('Fixture alternative');
  penne:=(public.save_catalog_product('Penne fixture',p_quantity:=500,p_unit:='g')->>'id')::uuid;
  select generic_product_id into penne from public.specific_products where id=penne;
  fusilli:=(public.save_catalog_product('Fusilli fixture',p_quantity:=500,p_unit:='g')->>'id')::uuid;
  select generic_product_id into fusilli from public.specific_products where id=fusilli;
  sauce:=(public.save_catalog_product('Passata fixture',p_quantity:=500,p_unit:='g')->>'id')::uuid;
  select generic_product_id into sauce from public.specific_products where id=sauce;
  r:=public.save_recipe('Pasta al sugo',2,'Cuoci',null,jsonb_build_array(
    jsonb_build_object('product_id',penne,'quantity',200,'unit','g','alternatives',jsonb_build_array(fusilli)),
    jsonb_build_object('product_id',sauce,'quantity',100,'unit','g')));
  select id into ingredient from public.recipe_ingredients where recipe_id=r and generic_product_id=penne;
  if (select count(*) from public.recipe_ingredient_alternatives where ingredient_id=ingredient)<>1 then raise exception 'Alternative not saved'; end if;
  copied:=public.duplicate_recipe(r);
  if (select count(*) from public.recipe_ingredient_alternatives a join public.recipe_ingredients i on i.id=a.ingredient_id where i.recipe_id=copied)<>1 then raise exception 'Alternative not duplicated'; end if;
  l:=public.ensure_shopping_list(h);
  perform public.add_recipe_choices_to_list(r,l,4,op,jsonb_build_object(ingredient::text,fusilli));
  perform public.add_recipe_choices_to_list(r,l,4,op,jsonb_build_object(ingredient::text,fusilli));
  if exists(select 1 from public.shopping_list_items where list_id=l and generic_product_id=penne) then raise exception 'Both alternatives added'; end if;
  if (select requested_quantity from public.list_item_contributions c join public.shopping_list_items i on i.id=c.item_id where i.list_id=l and i.generic_product_id=fusilli)<>400 then raise exception 'Scaling or idempotency failed'; end if;
  begin
    perform public.add_recipe_choices_to_list(r,l,2,gen_random_uuid(),jsonb_build_object(ingredient::text,sauce));
    raise exception 'Unrelated alternative allowed';
  exception when raise_exception then if sqlerrm not like 'Quantità non valida:%' then raise; end if; end;
  begin
    insert into public.recipe_ingredient_alternatives(household_id,ingredient_id,generic_product_id) values(h,ingredient,penne);
    raise exception 'Primary allowed as alternative';
  exception when raise_exception then if sqlerrm not like 'Quantità non valida:%' then raise; end if; end;
  insert into public.stores(household_id,name,chain,pam_discount_enabled) values(h,'PAM fixture','PAM',true) returning id into s;
  begin
    insert into public.stores(household_id,name,pam_discount_enabled) values(h,'Altro',true);
    raise exception 'Discount allowed outside PAM';
  exception when check_violation then null; end;
  insert into public.meal_plans(household_id,week_start) values(h,'2026-11-23') returning id into plan;
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id) values(h,plan,'2026-11-23','pranzo',r);
  select version into version_before from public.meal_plans where id=plan;
  delete from public.recipe_ingredient_alternatives where ingredient_id=ingredient;
  if (select version from public.meal_plans where id=plan)<=version_before then raise exception 'Preview not invalidated'; end if;
  insert into public.recipe_ingredient_alternatives(household_id,ingredient_id,generic_product_id) values(h,ingredient,fusilli) returning id into alt;
  perform set_config('request.jwt.claim.sub',(select value::text from alternative_context where key='eve'),true);
  h2:=public.create_household('Altra famiglia alternative');
  if exists(select 1 from public.recipe_ingredient_alternatives where id=alt) then raise exception 'Cross family read'; end if;
  begin
    insert into public.recipe_ingredient_alternatives(household_id,ingredient_id,generic_product_id) values(h2,ingredient,fusilli);
    raise exception 'Cross family write allowed';
  exception when insufficient_privilege then null; when foreign_key_violation then null; end;
  begin
    perform public.add_recipe_choices_to_list(r,l,2,gen_random_uuid());
    raise exception 'Cross family recipe allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',(select value::text from alternative_context where key='alice'),true);
  delete from public.recipe_ingredients where id=ingredient;
  if exists(select 1 from public.recipe_ingredient_alternatives where id=alt) then raise exception 'Orphan alternative'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.recipe_ingredient_alternatives','select') or has_function_privilege('anon','public.add_recipe_choices_to_list(uuid,uuid,integer,uuid,jsonb)','execute') then raise exception 'Anonymous exposure'; end if;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in('save_recipe','duplicate_recipe','add_recipe_choices_to_list') and prosecdef) then raise exception 'Public definer'; end if;
end $$;
rollback;
select 'PASS' as status;
