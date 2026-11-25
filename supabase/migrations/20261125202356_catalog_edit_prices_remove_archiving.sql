-- Preserve all existing records and links; the archive is no longer an application state.
update public.generic_products set archived_at=null where archived_at is not null;
update public.specific_products set archived_at=null where archived_at is not null;
update public.stores set archived_at=null where archived_at is not null;
update public.recipes set archived_at=null where archived_at is not null;
update public.meal_plans set archived_at=null,version=version+1 where archived_at is not null;
update public.price_estimate_snapshots set archived_at=null where archived_at is not null;
alter table public.generic_products add constraint generic_products_no_archive check(archived_at is null);
alter table public.specific_products add constraint specific_products_no_archive check(archived_at is null);
alter table public.stores add constraint stores_no_archive check(archived_at is null);
alter table public.recipes add constraint recipes_no_archive check(archived_at is null);
alter table public.meal_plans add constraint meal_plans_no_archive check(archived_at is null);
alter table public.price_estimate_snapshots add constraint price_estimate_snapshots_no_archive check(archived_at is null);

-- List removal keeps purchases and contributions; this is not a catalog/archive operation.
create function private.set_list_item_removed(p_id uuid,p_removed boolean,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare h uuid; parent_id uuid; current_version integer;
begin
 if p_removed is null then raise exception 'Quantità non valida: stato mancante'; end if;
 select household_id,list_id into h,parent_id from public.shopping_list_items where id=p_id;
 if auth.uid() is null or h is null or not private.is_member(h) then raise exception 'Accesso negato'; end if;
 select version into current_version from public.shopping_lists where id=parent_id and household_id=h for update;
 if p_version is distinct from current_version then raise exception 'Lista modificata: ricarica'; end if;
 update public.shopping_lists set version=version+1,updated_at=now() where id=parent_id and household_id=h;
 update public.shopping_list_items set archived_at=case when p_removed then now() else null end where id=p_id and household_id=h;
end $$;
revoke all on function private.set_list_item_removed(uuid,boolean,integer) from public,anon,authenticated;
grant execute on function private.set_list_item_removed(uuid,boolean,integer) to authenticated;
create function public.set_list_item_removed(p_id uuid,p_removed boolean,p_version integer)
returns void language sql security invoker set search_path='' as $$
 select private.set_list_item_removed(p_id,p_removed,p_version);
$$;
revoke all on function public.set_list_item_removed(uuid,boolean,integer) from public,anon,authenticated;
grant execute on function public.set_list_item_removed(uuid,boolean,integer) to authenticated;
-- Legacy list clients keep working; all general archiving calls are rejected.
create or replace function public.set_record_archived(p_type text,p_id uuid,p_archived boolean,p_version integer default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_type is distinct from 'shopping_list_items' then raise exception 'Accesso negato'; end if;
 perform private.set_list_item_removed(p_id,p_archived,p_version);
end $$;
revoke all on function public.set_record_archived(text,uuid,boolean,integer) from public,anon,authenticated;
grant execute on function public.set_record_archived(text,uuid,boolean,integer) to authenticated;

create function public.save_catalog_product_with_prices(p_product jsonb,p_store uuid,p_amount numeric,p_discounted numeric,p_basis text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved jsonb;
begin
 if jsonb_typeof(p_product) is distinct from 'object' or p_store is null then raise exception 'Prezzo non valido: scegli il supermercato.'; end if;
 if coalesce((p_product->>'p_specific')::boolean,false) and (p_product->>'p_id') is not null then
  perform id from public.specific_products where id=(p_product->>'p_id')::uuid for update;
  delete from public.product_prices where specific_product_id=(p_product->>'p_id')::uuid and store_id=p_store;
 end if;
 saved:=public.save_catalog_product(
  p_name:=p_product->>'p_name',p_category:=(p_product->>'p_category')::uuid,
  p_brand:=coalesce(p_product->>'p_brand',''),p_barcode:=p_product->>'p_barcode',
  p_quantity:=(p_product->>'p_quantity')::numeric,p_unit:=p_product->>'p_unit',p_variant:=coalesce(p_product->>'p_variant',''),
  p_id:=(p_product->>'p_id')::uuid,p_specific:=coalesce((p_product->>'p_specific')::boolean,false));
 perform public.set_product_prices((saved->>'id')::uuid,p_store,p_amount,p_discounted,p_basis);
 return saved;
end $$;
revoke all on function public.save_catalog_product_with_prices(jsonb,uuid,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.save_catalog_product_with_prices(jsonb,uuid,numeric,numeric,text) to authenticated;
