alter table public.stores add column pam_discount_enabled boolean not null default false;
alter table public.stores add constraint pam_discount_only_pam check (
  not pam_discount_enabled or (name || ' ' || chain) ~* '\mPAM\M'
);

alter table public.recipe_ingredients add constraint recipe_ingredients_id_household unique(id,household_id);
create table public.recipe_ingredient_alternatives (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  ingredient_id uuid not null,
  generic_product_id uuid not null,
  unique(ingredient_id,generic_product_id),
  foreign key(ingredient_id,household_id) references public.recipe_ingredients(id,household_id) on delete cascade,
  foreign key(generic_product_id,household_id) references public.generic_products(id,household_id) on delete cascade
);
create index recipe_alternatives_ingredient_household on public.recipe_ingredient_alternatives(ingredient_id,household_id);
create index recipe_alternatives_product_household on public.recipe_ingredient_alternatives(generic_product_id,household_id);
create index recipe_alternatives_household on public.recipe_ingredient_alternatives(household_id);
alter table public.recipe_ingredient_alternatives enable row level security;
create policy member_write on public.recipe_ingredient_alternatives for all to authenticated
  using(private.is_member(household_id)) with check(private.is_member(household_id));
revoke all on public.recipe_ingredient_alternatives from public,anon;
grant select,insert,update,delete on public.recipe_ingredient_alternatives to authenticated;
alter publication supabase_realtime add table public.recipe_ingredient_alternatives;

create function private.validate_recipe_alternative() returns trigger language plpgsql security invoker set search_path='' as $$
declare ingredient public.recipe_ingredients; u text;
begin
  select * into ingredient from public.recipe_ingredients where id=new.ingredient_id and household_id=new.household_id for update;
  if ingredient.id is null then raise exception 'Accesso negato' using errcode='42501'; end if;
  if new.generic_product_id=ingredient.generic_product_id then raise exception 'Quantità non valida: alternativa uguale all’ingrediente'; end if;
  select canonical_unit into u from public.generic_products where id=new.generic_product_id and household_id=new.household_id;
  if u is not null and u<>ingredient.unit and not (
    (u in ('g','kg') and ingredient.unit in ('g','kg')) or
    (u in ('ml','L') and ingredient.unit in ('ml','L'))
  ) then raise exception 'Quantità non valida: unità incompatibile per l’alternativa'; end if;
  if (select count(*) from public.recipe_ingredient_alternatives where ingredient_id=new.ingredient_id and id<>new.id)>=20 then
    raise exception 'Quantità non valida: massimo 20 alternative per ingrediente';
  end if;
  return new;
end $$;
revoke all on function private.validate_recipe_alternative() from public,anon,authenticated;
create trigger validate_recipe_alternative before insert or update on public.recipe_ingredient_alternatives
  for each row execute function private.validate_recipe_alternative();
create function private.alternative_plan_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP<>'INSERT' then update public.recipe_ingredients set quantity=quantity where id=old.ingredient_id and household_id=old.household_id; end if;
  if TG_OP<>'DELETE' then update public.recipe_ingredients set quantity=quantity where id=new.ingredient_id and household_id=new.household_id; end if;
  return null;
end $$;
revoke all on function private.alternative_plan_version() from public,anon,authenticated;
create trigger alternative_plan_version after insert or update or delete on public.recipe_ingredient_alternatives
  for each row execute function private.alternative_plan_version();

create or replace function public.save_recipe(p_title text,p_servings integer,p_instructions text,p_source text,p_ingredients jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare h uuid; result uuid; row jsonb; ingredient uuid; alt jsonb;
begin
  select household_id into h from public.household_members where user_id=auth.uid() and status='active';
  if h is null then raise exception 'Accesso negato' using errcode='42501'; end if;
  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) not between 1 and 50 then raise exception 'Quantità non valida: ingredienti'; end if;
  insert into public.recipes(household_id,title,base_servings,instructions,source_url)
    values(h,p_title,p_servings,left(p_instructions,50000),p_source) returning id into result;
  for row in select * from jsonb_array_elements(p_ingredients) loop
    insert into public.recipe_ingredients(household_id,recipe_id,generic_product_id,quantity,unit)
      values(h,result,(row->>'product_id')::uuid,(row->>'quantity')::numeric,row->>'unit') returning id into ingredient;
    if row ? 'alternatives' then
      if jsonb_typeof(row->'alternatives') is distinct from 'array' or jsonb_array_length(row->'alternatives')>20 then raise exception 'Quantità non valida: alternative'; end if;
      for alt in select * from jsonb_array_elements(row->'alternatives') loop
        insert into public.recipe_ingredient_alternatives(household_id,ingredient_id,generic_product_id)
          values(h,ingredient,(alt#>>'{}')::uuid);
      end loop;
    end if;
  end loop;
  return result;
end $$;

create or replace function public.duplicate_recipe(p_recipe uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.recipes; result uuid; ingredient public.recipe_ingredients; new_ingredient uuid;
begin
  select * into r from public.recipes where id=p_recipe;
  if r.id is null or not private.is_member(r.household_id) then raise exception 'Accesso negato' using errcode='42501'; end if;
  insert into public.recipes(household_id,title,base_servings,instructions,notes,source_url)
    values(r.household_id,left(r.title,185)||' (copia)',r.base_servings,r.instructions,r.notes,r.source_url) returning id into result;
  for ingredient in select * from public.recipe_ingredients where recipe_id=p_recipe loop
    insert into public.recipe_ingredients(household_id,recipe_id,generic_product_id,quantity,unit)
      values(r.household_id,result,ingredient.generic_product_id,ingredient.quantity,ingredient.unit) returning id into new_ingredient;
    insert into public.recipe_ingredient_alternatives(household_id,ingredient_id,generic_product_id)
      select household_id,new_ingredient,generic_product_id from public.recipe_ingredient_alternatives where ingredient_id=ingredient.id;
  end loop;
  return result;
end $$;

-- List writes are intentionally restricted to authenticated, validated workflows.
create function private.add_recipe_choices_to_list(p_recipe uuid,p_list uuid,p_servings integer,p_operation uuid,p_choices jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.recipes; l public.shopping_lists; ingredient public.recipe_ingredients; item uuid; q numeric; product uuid; name text; choice record;
begin
  select * into l from public.shopping_lists where id=p_list for update;
  select * into r from public.recipes where id=p_recipe;
  if auth.uid() is null or l.id is null or r.id is null or r.household_id<>l.household_id or not private.is_member(l.household_id) then raise exception 'Accesso negato' using errcode='42501'; end if;
  if p_servings is null or p_servings not between 1 and 100 or p_operation is null or jsonb_typeof(p_choices) is distinct from 'object' then raise exception 'Quantità non valida: scelta ingredienti'; end if;
  if exists(select 1 from public.list_item_contributions c join public.shopping_list_items i on i.id=c.item_id where c.origin_type='recipe' and c.origin_id=p_operation and i.list_id=p_list and c.household_id=l.household_id) then return; end if;
  for choice in select * from jsonb_each_text(p_choices) loop
    if not exists(select 1 from public.recipe_ingredients where id=choice.key::uuid and recipe_id=p_recipe) then raise exception 'Quantità non valida: ingrediente estraneo'; end if;
  end loop;
  for ingredient in select * from public.recipe_ingredients where recipe_id=p_recipe loop
    product:=coalesce((p_choices->>ingredient.id::text)::uuid,ingredient.generic_product_id);
    if product<>ingredient.generic_product_id and not exists(select 1 from public.recipe_ingredient_alternatives where ingredient_id=ingredient.id and generic_product_id=product) then raise exception 'Quantità non valida: alternativa non prevista'; end if;
    select g.name into name from public.generic_products g where g.id=product and g.household_id=l.household_id;
    if name is null then raise exception 'Accesso negato' using errcode='42501'; end if;
    q:=ingredient.quantity*p_servings/r.base_servings;
    if ingredient.unit in ('pz','conf') then q:=ceil(q); else q:=round(q,3); end if;
    select id into item from public.shopping_list_items where list_id=p_list and generic_product_id=product and specific_product_id is null and preferred_brand is null and preferred_package_quantity is null and unit=ingredient.unit order by created_at,id limit 1;
    if item is null then insert into public.shopping_list_items(household_id,list_id,name,unit,generic_product_id) values(l.household_id,p_list,name,ingredient.unit,product) returning id into item; end if;
    insert into public.list_item_contributions(household_id,item_id,origin_type,origin_id,requested_quantity)
      values(l.household_id,item,'recipe',p_operation,q)
      on conflict(item_id,origin_type,origin_id) do update set requested_quantity=public.list_item_contributions.requested_quantity+excluded.requested_quantity;
  end loop;
  update public.shopping_lists set version=version+1,updated_at=now() where id=p_list;
end $$;
revoke all on function private.add_recipe_choices_to_list(uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.add_recipe_choices_to_list(uuid,uuid,integer,uuid,jsonb) to authenticated;
create function public.add_recipe_choices_to_list(p_recipe uuid,p_list uuid,p_servings integer,p_operation uuid,p_choices jsonb default '{}')
returns void language sql security invoker set search_path='' as $$
  select private.add_recipe_choices_to_list(p_recipe,p_list,p_servings,p_operation,p_choices);
$$;
revoke all on function public.add_recipe_choices_to_list(uuid,uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.add_recipe_choices_to_list(uuid,uuid,integer,uuid,jsonb) to authenticated;
revoke all on function public.save_recipe(text,integer,text,text,jsonb) from public,anon;
revoke all on function public.duplicate_recipe(uuid) from public,anon;
grant execute on function public.save_recipe(text,integer,text,text,jsonb),public.duplicate_recipe(uuid) to authenticated;
