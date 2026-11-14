create function public.duplicate_list(p_list uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare l public.shopping_lists; result uuid; row record; item uuid; begin
  select * into l from public.shopping_lists where id=p_list for update;
  if not private.is_member(l.household_id) then raise exception 'Accesso negato'; end if;
  insert into public.shopping_lists(household_id,title) values(l.household_id,left(l.title,185)||' (copia)') returning id into result;
  for row in select i.*,coalesce((select sum(requested_quantity) from public.list_item_contributions where item_id=i.id),0) as requested from public.shopping_list_items i where list_id=p_list loop
    insert into public.shopping_list_items(household_id,list_id,name,unit,generic_product_id,specific_product_id,note,sort_order) values(l.household_id,result,row.name,row.unit,row.generic_product_id,row.specific_product_id,row.note,row.sort_order) returning id into item;
    insert into public.list_item_contributions(household_id,item_id,origin_type,origin_id,requested_quantity) values(l.household_id,item,'manual',item,row.requested);
  end loop;
  return result;
end $$;
create function public.save_recipe(p_title text,p_servings integer,p_instructions text,p_source text,p_ingredients jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; result uuid; row jsonb; begin
  select household_id into h from public.household_members where user_id=auth.uid() and status='active';
  if h is null then raise exception 'Accesso negato'; end if;
  if jsonb_typeof(p_ingredients)<>'array' or jsonb_array_length(p_ingredients)>50 then raise exception 'Ingredienti non validi'; end if;
  insert into public.recipes(household_id,title,base_servings,instructions,source_url) values(h,p_title,p_servings,left(p_instructions,50000),p_source) returning id into result;
  for row in select * from jsonb_array_elements(p_ingredients) loop
    insert into public.recipe_ingredients(household_id,recipe_id,generic_product_id,quantity,unit) values(h,result,(row->>'product_id')::uuid,(row->>'quantity')::numeric,row->>'unit');
  end loop;
  return result;
end $$;
create function public.duplicate_recipe(p_recipe uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.recipes; result uuid; begin
  select * into r from public.recipes where id=p_recipe;
  if not private.is_member(r.household_id) then raise exception 'Accesso negato'; end if;
  insert into public.recipes(household_id,title,base_servings,instructions,notes,source_url) values(r.household_id,left(r.title,185)||' (copia)',r.base_servings,r.instructions,r.notes,r.source_url) returning id into result;
  insert into public.recipe_ingredients(household_id,recipe_id,generic_product_id,quantity,unit) select household_id,result,generic_product_id,quantity,unit from public.recipe_ingredients where recipe_id=p_recipe;
  return result;
end $$;
create function public.add_recipe_to_list(p_recipe uuid,p_list uuid,p_servings integer,p_operation uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.recipes; l public.shopping_lists; ingredient record; item uuid; q numeric; begin
  select * into l from public.shopping_lists where id=p_list for update;
  select * into r from public.recipes where id=p_recipe;
  if not private.is_member(l.household_id) or r.household_id<>l.household_id then raise exception 'Accesso negato'; end if;
  if p_servings not between 1 and 100 then raise exception 'Porzioni non valide'; end if;
  if exists(select 1 from public.list_item_contributions where origin_type='recipe' and origin_id=p_operation) then return; end if;
  for ingredient in select i.*,g.name from public.recipe_ingredients i join public.generic_products g on g.id=i.generic_product_id where recipe_id=p_recipe loop
    q:=ingredient.quantity*p_servings/r.base_servings;
    if ingredient.unit in ('pz','conf') then q:=ceil(q); else q:=round(q,3); end if;
    select id into item from public.shopping_list_items where list_id=p_list and generic_product_id=ingredient.generic_product_id and unit=ingredient.unit order by created_at,id limit 1;
    if item is null then
      insert into public.shopping_list_items(household_id,list_id,name,unit,generic_product_id) values(l.household_id,p_list,ingredient.name,ingredient.unit,ingredient.generic_product_id) returning id into item;
    end if;
    insert into public.list_item_contributions(household_id,item_id,origin_type,origin_id,requested_quantity) values(l.household_id,item,'recipe',p_operation,q)
      on conflict(item_id,origin_type,origin_id) do update set requested_quantity=public.list_item_contributions.requested_quantity+excluded.requested_quantity;
  end loop;
  update public.shopping_lists set version=version+1,updated_at=now() where id=p_list;
end $$;
create function public.duplicate_week(p_plan uuid,p_week date) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.meal_plans; result uuid; begin
  select * into p from public.meal_plans where id=p_plan;
  if not private.is_member(p.household_id) then raise exception 'Accesso negato'; end if;
  insert into public.meal_plans(household_id,week_start) values(p.household_id,p_week) returning id into result;
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id,generic_product_id,quantity,unit,servings_override)
    select household_id,result,p_week+(meal_date-p.week_start),meal_slot,recipe_id,generic_product_id,quantity,unit,servings_override from public.meal_entries where meal_plan_id=p_plan;
  return result;
end $$;
create function public.apply_template(p_template uuid,p_plan uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.meal_plans; t public.meal_templates; row jsonb; day integer; begin
  select * into p from public.meal_plans where id=p_plan for update;
  select * into t from public.meal_templates where id=p_template;
  if not private.is_member(p.household_id) or t.household_id<>p.household_id then raise exception 'Accesso negato'; end if;
  if jsonb_array_length(t.entries_json)>500 then raise exception 'Modello troppo grande'; end if;
  for row in select * from jsonb_array_elements(t.entries_json) loop
    day:=(row->>'day_offset')::integer;
    if day not between 0 and 6 then raise exception 'Giorno non valido'; end if;
    insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id,generic_product_id,quantity,unit,servings_override)
      values(p.household_id,p_plan,p.week_start+day,row->>'meal_slot',(row->>'recipe_id')::uuid,(row->>'generic_product_id')::uuid,(row->>'quantity')::numeric,row->>'unit',(row->>'servings_override')::integer);
  end loop;
end $$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
    execute format('revoke all on function %s from public',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
