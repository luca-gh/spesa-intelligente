-- Supabase can grant anon/authenticated privileges through owner defaults.
-- Revoke explicit role grants as well as PUBLIC grants, then allow only the
-- operations required by this application. RLS remains enabled throughout.
do $$
declare table_name text; f record;
begin
  foreach table_name in array array[
    'households','profiles','household_members','household_invites','categories',
    'generic_products','specific_products','stores','price_observations',
    'store_discount_rules','shopping_lists','shopping_list_items',
    'list_item_contributions','purchases','recipes','recipe_ingredients',
    'meal_plans','meal_entries','meal_templates','price_estimate_snapshots'
  ] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    if table_name='households' then
      execute format('grant select,update on table public.%I to authenticated',table_name);
    elsif table_name in ('household_members','household_invites','shopping_list_items','list_item_contributions','purchases','price_observations','price_estimate_snapshots') then
      execute format('grant select on table public.%I to authenticated',table_name);
    else
      execute format('grant select,insert,update,delete on table public.%I to authenticated',table_name);
    end if;
  end loop;
  for f in
    select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname=any(array[
      'create_household','create_invite','accept_invite','revoke_invite','leave_household',
      'add_list_item','record_purchase','void_purchase','complete_purchase_price',
      'add_price','void_price','save_estimate','apply_plan_diff','remove_list_item',
      'update_manual_item','duplicate_list','save_recipe','duplicate_recipe',
      'add_recipe_to_list','duplicate_week','apply_template','delete_household'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
