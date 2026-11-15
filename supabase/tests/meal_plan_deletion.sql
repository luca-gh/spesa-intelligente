-- Synthetic fixtures only. Verify existing DELETE/RLS/FK behavior; no migration needed.
begin;
set local statement_timeout='20s';
create temporary table plan_delete_context(key text primary key,value uuid not null) on commit drop;
grant select on plan_delete_context to authenticated;
insert into plan_delete_context values('alice',gen_random_uuid()),('eve',gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at)
select value,'authenticated','authenticated','plan-delete-'||value||'@example.invalid',now(),now() from plan_delete_context;
select set_config('request.jwt.claim.sub',(select value::text from plan_delete_context where key='alice'),true);
set local role authenticated;
do $$
declare h uuid; l uuid; food uuid; recipe uuid; plan uuid; other_plan uuid; item uuid; recreated uuid;
  changed integer; before_list jsonb; after_list jsonb;
begin
  h:=public.create_household('Fixture eliminazione piano');
  l:=public.ensure_shopping_list(h);
  insert into public.generic_products(household_id,name,canonical_unit) values(h,'Ingrediente fixture','g') returning id into food;
  recipe:=public.save_recipe('Ricetta fixture',2,'',null,jsonb_build_array(jsonb_build_object('product_id',food,'quantity',2,'unit','g')));
  insert into public.meal_plans(household_id,week_start,linked_list_id) values(h,'2026-11-16',l) returning id into plan;
  insert into public.meal_plans(household_id,week_start) values(h,'2026-11-23') returning id into other_plan;
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id)
    values(h,plan,'2026-11-16','pranzo',recipe),(h,other_plan,'2026-11-23','pranzo',recipe);
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,generic_product_id,quantity,unit)
    values(h,plan,'2026-11-16','cena',food,2,'g');
  insert into public.meal_templates(household_id,name,entries_json)
    values(h,'Modello fixture',jsonb_build_array(jsonb_build_object('recipe_id',recipe,'day_offset',0,'meal_slot','pranzo')));
  perform public.apply_plan_diff(l,plan,(select version from public.shopping_lists where id=l),
    jsonb_build_array(jsonb_build_object('product_id',food,'quantity',4,'unit','g')),
    (select version from public.meal_plans where id=plan));
  select id into item from public.shopping_list_items where list_id=l and generic_product_id=food;
  perform public.record_purchase(gen_random_uuid(),item,1,2);
  select jsonb_build_object(
    'list',(select to_jsonb(r) from public.shopping_lists r where id=l),
    'items',(select jsonb_agg(to_jsonb(r) order by id) from public.shopping_list_items r where list_id=l),
    'contributions',(select jsonb_agg(to_jsonb(r) order by id) from public.list_item_contributions r where household_id=h),
    'purchases',(select jsonb_agg(to_jsonb(r) order by id) from public.purchases r where household_id=h)
  ) into before_list;
  perform set_config('request.jwt.claim.sub',(select value::text from plan_delete_context where key='eve'),true);
  perform public.create_household('Altra famiglia fixture piano');
  delete from public.meal_plans where id=plan;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Cross-family delete accepted'; end if;
  perform set_config('request.jwt.claim.sub',(select value::text from plan_delete_context where key='alice'),true);
  delete from public.meal_plans where id=plan;
  get diagnostics changed=row_count;
  if changed<>1 or exists(select 1 from public.meal_entries where meal_plan_id=plan)
    then raise exception 'Plan or meals not deleted'; end if;
  select jsonb_build_object(
    'list',(select to_jsonb(r) from public.shopping_lists r where id=l),
    'items',(select jsonb_agg(to_jsonb(r) order by id) from public.shopping_list_items r where list_id=l),
    'contributions',(select jsonb_agg(to_jsonb(r) order by id) from public.list_item_contributions r where household_id=h),
    'purchases',(select jsonb_agg(to_jsonb(r) order by id) from public.purchases r where household_id=h)
  ) into after_list;
  if before_list is distinct from after_list then raise exception 'List or purchases changed'; end if;
  if not exists(select 1 from public.recipes where id=recipe)
    or not exists(select 1 from public.recipe_ingredients where recipe_id=recipe)
    or not exists(select 1 from public.meal_templates where household_id=h)
    or not exists(select 1 from public.meal_entries where meal_plan_id=other_plan)
    then raise exception 'Other plan, recipe or template changed'; end if;
  insert into public.meal_plans(household_id,week_start) values(h,'2026-11-16') returning id into recreated;
  if recreated=plan or exists(select 1 from public.meal_entries where meal_plan_id=recreated)
    then raise exception 'Recreated plan contains deleted meals'; end if;
  perform public.set_record_archived('meal_plans',recreated,true,1);
  delete from public.meal_plans where id=recreated;
  if exists(select 1 from public.meal_plans where id=recreated) then raise exception 'Archived plan not deleted'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    delete from public.meal_plans where id='00000000-0000-4000-8000-000000000000';
    raise exception 'Anon delete permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS' as status,'Plan deletion: meals removed, list/history/recipes/templates retained, RLS and rollback verified' as verification;
