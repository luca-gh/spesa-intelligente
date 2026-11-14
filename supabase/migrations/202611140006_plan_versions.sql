-- Bump plans when source meals or recipes change, so stale previews cannot be confirmed.
create function private.bump_plan_version() returns trigger language plpgsql security definer set search_path='' as $$ begin
  if TG_TABLE_NAME='meal_entries' then
    if TG_OP<>'INSERT' then update public.meal_plans set version=version+1 where id=old.meal_plan_id; end if;
    if TG_OP<>'DELETE' then update public.meal_plans set version=version+1 where id=new.meal_plan_id; end if;
  elsif TG_TABLE_NAME='recipe_ingredients' then
    if TG_OP<>'INSERT' then update public.meal_plans set version=version+1 where id in (select meal_plan_id from public.meal_entries where recipe_id=old.recipe_id); end if;
    if TG_OP<>'DELETE' then update public.meal_plans set version=version+1 where id in (select meal_plan_id from public.meal_entries where recipe_id=new.recipe_id); end if;
  else
    update public.meal_plans set version=version+1 where id in (select meal_plan_id from public.meal_entries where recipe_id=new.id);
  end if;
  return null;
end $$;
revoke all on function private.bump_plan_version() from public;
create trigger meal_plan_version after insert or update or delete on public.meal_entries for each row execute function private.bump_plan_version();
create trigger recipe_ingredient_plan_version after insert or update or delete on public.recipe_ingredients for each row execute function private.bump_plan_version();
create trigger recipe_plan_version after update on public.recipes for each row execute function private.bump_plan_version();
