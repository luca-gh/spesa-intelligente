begin;
set local statement_timeout='30s';
create temporary table meal_test_context(key text primary key,value uuid not null) on commit drop;
grant select,insert on meal_test_context to authenticated;
insert into meal_test_context values('alice',gen_random_uuid()),('eve',gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at)
  select value,'authenticated','authenticated','meal-choices-'||value||'@example.invalid',now(),now() from meal_test_context;
select set_config('request.jwt.claim.sub',(select value::text from meal_test_context where key='alice'),true);
set local role authenticated;
do $$
declare h uuid; h2 uuid; penne uuid; fusilli uuid; r uuid; ingredient uuid; plan uuid; copied uuid; target uuid; meal uuid; template uuid; list uuid; version_before integer;
begin
  h:=public.create_household('Fixture pasti');
  penne:=(public.save_catalog_product('Penne pasto',p_quantity:=500,p_unit:='g')->>'id')::uuid;
  select generic_product_id into penne from public.specific_products where id=penne;
  fusilli:=(public.save_catalog_product('Fusilli pasto',p_quantity:=500,p_unit:='g')->>'id')::uuid;
  select generic_product_id into fusilli from public.specific_products where id=fusilli;
  r:=public.save_recipe('Pasta pasto',2,'Cuoci',null,jsonb_build_array(jsonb_build_object('product_id',penne,'quantity',200,'unit','g','alternatives',jsonb_build_array(fusilli))));
  select id into ingredient from public.recipe_ingredients where recipe_id=r;
  insert into public.meal_plans(household_id,week_start) values(h,'2026-11-23') returning id into plan;
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,free_text,shopping_choices)
    values(h,plan,'2026-11-23','cena','Cena fuori','{}');
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id,servings_override,shopping_choices)
    values(h,plan,'2026-11-23','pranzo',r,4,'{}') returning id into meal;
  select version into version_before from public.meal_plans where id=plan;
  update public.meal_entries set shopping_choices=jsonb_build_object(ingredient::text,fusilli) where id=meal;
  if (select version from public.meal_plans where id=plan)<=version_before then raise exception 'Plan version unchanged'; end if;
  begin
    update public.meal_entries set shopping_choices=jsonb_build_object(ingredient::text,gen_random_uuid()) where id=meal;
    raise exception 'Foreign product accepted';
  exception when raise_exception then if sqlerrm not like 'Quantità non valida:%' then raise; end if; end;
  begin
    insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,free_text,generic_product_id,quantity,unit)
      values(h,plan,'2026-11-23','cena','Misto',penne,100,'g');
    raise exception 'Mixed text and product allowed';
  exception when check_violation then null; end;
  begin
    insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,free_text,shopping_choices)
      values(h,plan,'2026-11-23','cena','Cena fuori',jsonb_build_object('food',penne));
    raise exception 'Free text invented food';
  exception when raise_exception then if sqlerrm not like 'Quantità non valida:%' then raise; end if; end;
  list:=public.ensure_shopping_list(h);
  perform public.apply_plan_diff(list,plan,(select version from public.shopping_lists where id=list),jsonb_build_array(jsonb_build_object('product_id',fusilli,'quantity',400,'unit','g')),(select version from public.meal_plans where id=plan));
  if (select count(*) from public.shopping_list_items where list_id=list)<>1 then raise exception 'Unselected ingredients added'; end if;
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,generic_product_id,quantity,unit)
    values(h,plan,'2026-11-23','spuntino',penne,100,'g');
  copied:=public.duplicate_week(plan,'2026-11-30');
  if not exists(select 1 from public.meal_entries where meal_plan_id=copied and free_text='Cena fuori') or
    not exists(select 1 from public.meal_entries where meal_plan_id=copied and shopping_choices=jsonb_build_object(ingredient::text,fusilli)) or
    exists(select 1 from public.meal_entries where meal_plan_id=copied and meal_slot='spuntino') then raise exception 'Week copy lost text/choices or copied snack'; end if;
  insert into public.meal_templates(household_id,name,entries_json) values(h,'Fixture modello',jsonb_build_array(
    jsonb_build_object('day_offset',0,'meal_slot','cena','free_text','Cena fuori','shopping_choices','{}'::jsonb),
    jsonb_build_object('day_offset',0,'meal_slot','pranzo','recipe_id',r,'servings_override',4,'shopping_choices',jsonb_build_object(ingredient::text,fusilli)))) returning id into template;
  insert into public.meal_plans(household_id,week_start) values(h,'2026-12-07') returning id into target;
  perform public.apply_template(template,target);
  if (select count(*) from public.meal_entries where meal_plan_id=target)<>2 then raise exception 'Template lost components'; end if;
  delete from public.recipe_ingredient_alternatives where ingredient_id=ingredient;
  perform public.duplicate_week(plan,'2026-12-14');
  perform set_config('request.jwt.claim.sub',(select value::text from meal_test_context where key='eve'),true);
  h2:=public.create_household('Altra famiglia pasti');
  if exists(select 1 from public.meal_entries where id=meal) then raise exception 'Cross family read'; end if;
  begin
    perform public.duplicate_week(plan,'2026-12-14');
    raise exception 'Cross family week copy';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_template(template,target);
    raise exception 'Cross family template';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in('duplicate_week','apply_template') and prosecdef) then raise exception 'Public definer'; end if;
  if has_function_privilege('anon','public.duplicate_week(uuid,date)','execute') or has_function_privilege('anon','public.apply_template(uuid,uuid)','execute') then raise exception 'Anon exposed'; end if;
end $$;
rollback;
select 'PASS' as status;
