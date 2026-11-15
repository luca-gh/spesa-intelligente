-- Explicit, irreversible catalog deletion. Installing this migration deletes no family data.
-- Accounting tables stay RPC-only; the privileged implementation is outside the exposed schema.
create function private.delete_catalog_product(p_id uuid,p_specific boolean) returns void
language plpgsql security definer set search_path='' as $$
declare
  h uuid; g uuid; s public.specific_products;
  specifics uuid[] := '{}'; generics uuid[] := '{}'; items uuid[] := '{}'; bought uuid[] := '{}';
  references_to_remove uuid[];
begin
  if auth.uid() is null or p_id is null or p_specific is null then raise exception 'Accesso negato'; end if;
  select household_id into h from public.household_members where user_id=auth.uid() and status='active';
  if h is null or not private.is_member(h) then raise exception 'Accesso negato'; end if;

  -- Same order as purchase and plan-diff RPCs: lists, then plans, then products.
  perform 1 from public.shopping_lists where household_id=h order by id for update;
  perform 1 from public.meal_plans where household_id=h order by id for update;
  if p_specific then
    select * into s from public.specific_products where id=p_id and household_id=h for update;
    if not found then raise exception 'Accesso negato'; end if;
    specifics := array[p_id];
    if s.generic_product_id is not null then
      perform 1 from public.generic_products where id=s.generic_product_id and household_id=h for update;
      -- Generic recipe/meal links describe the food shared by every brand, including archived cards.
      -- Remove that group only when its last card is removed.
      if not exists(select 1 from public.specific_products where generic_product_id=s.generic_product_id and household_id=h and id<>p_id) then
        generics := array[s.generic_product_id];
      end if;
    end if;
  else
    -- Legacy standalone products can still have dependent cards.
    perform 1 from public.specific_products where generic_product_id=p_id and household_id=h order by id for update;
    select id into g from public.generic_products where id=p_id and household_id=h for update;
    if not found then raise exception 'Accesso negato'; end if;
    generics := array[p_id];
    select coalesce(array_agg(id),'{}'::uuid[]) into specifics from public.specific_products where generic_product_id=g and household_id=h;
  end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into items from public.shopping_list_items
    where household_id=h and (specific_product_id=any(specifics) or generic_product_id=any(generics));
  select coalesce(array_agg(id),'{}'::uuid[]) into bought from public.purchases
    where household_id=h and (specific_product_id=any(specifics) or list_item_id=any(items));
  references_to_remove := specifics || generics || items || bought;

  -- Saved estimates contain prices and totals: discard only estimates referencing deleted data,
  -- rather than leaving a misleading total after removing a line.
  delete from public.price_estimate_snapshots snapshot where household_id=h and exists(
    select 1 from unnest(references_to_remove) ref(id)
    where jsonb_path_exists(snapshot.detail_json,'$.** ? (@ == $id)',jsonb_build_object('id',ref.id::text))
  );
  update public.store_discount_rules rule set excluded_product_ids=array(
    select id from unnest(rule.excluded_product_ids) with ordinality excluded(id,position)
    where not (id=any(specifics || generics)) order by position
  ) where household_id=h and excluded_product_ids && (specifics || generics);
  -- Preserve templates and their other entries, in their original order. No UUID casts of user JSON.
  update public.meal_templates template set entries_json=coalesce((
    select jsonb_agg(entry order by position) from jsonb_array_elements(template.entries_json) with ordinality rows(entry,position)
    where not exists(select 1 from unnest(generics) ref(id) where entry->>'generic_product_id'=ref.id::text)
  ),'[]'::jsonb) where household_id=h and exists(
    select 1 from jsonb_array_elements(template.entries_json) entry,unnest(generics) ref(id)
    where entry->>'generic_product_id'=ref.id::text
  );

  -- Invalidate list previews even if only an explicitly branded purchase is removed.
  update public.shopping_lists set version=version+1,updated_at=now() where household_id=h and id in (
    select list_id from public.shopping_list_items where household_id=h and
      (id=any(items) or id in(select list_item_id from public.purchases where household_id=h and id=any(bought)))
  );
  delete from public.price_observations where household_id=h and
    (specific_product_id=any(specifics) or (source='purchase' and source_id=any(bought)));
  delete from public.purchases where household_id=h and id=any(bought);
  -- Contributions cascade only from these exact list items, including previously removed items.
  delete from public.shopping_list_items where household_id=h and id=any(items);
  delete from public.meal_entries where household_id=h and generic_product_id=any(generics);
  delete from public.recipe_ingredients where household_id=h and generic_product_id=any(generics);
  -- Existing triggers bump affected meal-plan versions when meals/ingredients are deleted.
  delete from public.specific_products where household_id=h and id=any(specifics);
  delete from public.generic_products where household_id=h and id=any(generics);
end $$;
revoke all on function private.delete_catalog_product(uuid,boolean) from public,anon,authenticated;
grant execute on function private.delete_catalog_product(uuid,boolean) to authenticated;

create function public.delete_catalog_product(p_id uuid,p_specific boolean) returns void
language sql security invoker set search_path='' as $$
  select private.delete_catalog_product(p_id,p_specific);
$$;
revoke all on function public.delete_catalog_product(uuid,boolean) from public,anon,authenticated;
grant execute on function public.delete_catalog_product(uuid,boolean) to authenticated;
