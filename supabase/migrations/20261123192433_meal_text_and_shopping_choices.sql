alter table public.meal_entries add column free_text text check(free_text is null or length(btrim(free_text)) between 1 and 200);
alter table public.meal_entries add column shopping_choices jsonb check(shopping_choices is null or jsonb_typeof(shopping_choices)='object');
alter table public.meal_entries drop constraint meal_entries_check;
alter table public.meal_entries add constraint meal_entries_component check(num_nonnulls(recipe_id,generic_product_id,free_text)=1);

create function private.validate_meal_shopping_choices() returns trigger language plpgsql security invoker set search_path='' as $$
declare choice record;
begin
  if new.shopping_choices is null then return new; end if;
  if (select count(*) from jsonb_object_keys(new.shopping_choices))>50 then raise exception 'Quantità non valida: selezione del pasto'; end if;
  for choice in select * from jsonb_each_text(new.shopping_choices) loop
    if choice.value is null then raise exception 'Quantità non valida: alimento del pasto'; end if;
    if new.recipe_id is not null then
      if not exists(select 1 from public.recipe_ingredients i where i.id=choice.key::uuid and i.household_id=new.household_id and i.recipe_id=new.recipe_id and
        (i.generic_product_id=choice.value::uuid or exists(select 1 from public.recipe_ingredient_alternatives a where a.ingredient_id=i.id and a.household_id=new.household_id and a.generic_product_id=choice.value::uuid))) then
        raise exception 'Quantità non valida: alimento non previsto dal pasto';
      end if;
    elsif new.generic_product_id is not null then
      if choice.key<>'food' or choice.value::uuid<>new.generic_product_id then raise exception 'Quantità non valida: alimento non previsto dal pasto'; end if;
    else raise exception 'Quantità non valida: un testo libero non contiene alimenti';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.validate_meal_shopping_choices() from public,anon,authenticated;
create trigger validate_meal_shopping_choices before insert or update on public.meal_entries
  for each row execute function private.validate_meal_shopping_choices();

-- Copies retain valid choices and discard links removed from the recipe/catalog since saving.
create function private.clean_meal_choices(p_recipe uuid,p_generic uuid,p_choices jsonb,p_household uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select case when p_choices is null then null else (
    select coalesce(jsonb_object_agg(c.key,c.value),'{}'::jsonb) from jsonb_each_text(p_choices) c
    where (p_generic is not null and c.key='food' and c.value=p_generic::text) or exists(
      select 1 from public.recipe_ingredients i where i.id::text=c.key and i.recipe_id=p_recipe and i.household_id=p_household and
      (i.generic_product_id::text=c.value or exists(select 1 from public.recipe_ingredient_alternatives a where a.ingredient_id=i.id and a.generic_product_id::text=c.value and a.household_id=p_household))
    )
  ) end;
$$;
revoke all on function private.clean_meal_choices(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.clean_meal_choices(uuid,uuid,jsonb,uuid) to authenticated;

create or replace function public.duplicate_week(p_plan uuid,p_week date) returns uuid language plpgsql security invoker set search_path='' as $$
declare p public.meal_plans; result uuid;
begin
  select * into p from public.meal_plans where id=p_plan;
  if auth.uid() is null or p.id is null or not private.is_member(p.household_id) then raise exception 'Accesso negato' using errcode='42501'; end if;
  insert into public.meal_plans(household_id,week_start) values(p.household_id,p_week) returning id into result;
  insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id,generic_product_id,quantity,unit,servings_override,free_text,shopping_choices)
    select household_id,result,p_week+(meal_date-p.week_start),meal_slot,recipe_id,generic_product_id,quantity,unit,servings_override,free_text,private.clean_meal_choices(recipe_id,generic_product_id,shopping_choices,household_id)
    from public.meal_entries where meal_plan_id=p_plan and meal_slot<>'spuntino';
  return result;
end $$;

create or replace function public.apply_template(p_template uuid,p_plan uuid) returns void language plpgsql security invoker set search_path='' as $$
declare p public.meal_plans; t public.meal_templates; row jsonb; day integer;
begin
  select * into p from public.meal_plans where id=p_plan for update;
  select * into t from public.meal_templates where id=p_template;
  if auth.uid() is null or p.id is null or t.id is null or not private.is_member(p.household_id) or t.household_id<>p.household_id then raise exception 'Accesso negato' using errcode='42501'; end if;
  if jsonb_array_length(t.entries_json)>500 then raise exception 'Modello troppo grande'; end if;
  for row in select * from jsonb_array_elements(t.entries_json) loop
    if row->>'meal_slot'='spuntino' then continue; end if;
    day:=(row->>'day_offset')::integer;
    if day not between 0 and 6 then raise exception 'Giorno non valido'; end if;
    insert into public.meal_entries(household_id,meal_plan_id,meal_date,meal_slot,recipe_id,generic_product_id,quantity,unit,servings_override,free_text,shopping_choices)
      values(p.household_id,p_plan,p.week_start+day,row->>'meal_slot',(row->>'recipe_id')::uuid,(row->>'generic_product_id')::uuid,
        (row->>'quantity')::numeric,row->>'unit',(row->>'servings_override')::integer,row->>'free_text',private.clean_meal_choices((row->>'recipe_id')::uuid,(row->>'generic_product_id')::uuid,nullif(row->'shopping_choices','null'::jsonb),p.household_id));
  end loop;
end $$;
revoke all on function public.duplicate_week(uuid,date),public.apply_template(uuid,uuid) from public,anon;
grant execute on function public.duplicate_week(uuid,date),public.apply_template(uuid,uuid) to authenticated;
