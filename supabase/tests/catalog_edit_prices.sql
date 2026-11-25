begin;
set local statement_timeout='30s';
create temporary table edit_context(id uuid) on commit drop;
insert into edit_context values(gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at) select id,'authenticated','authenticated','edit-'||id||'@example.invalid',now(),now() from edit_context;
select set_config('request.jwt.claim.sub',(select id::text from edit_context),true);
set local role authenticated;
do $$
declare h uuid; p uuid; s uuid; other_store uuid; l uuid; i uuid; v integer; body jsonb;
begin
 h:=public.create_household('Fixture modifica');
 insert into public.stores(household_id,name) values(h,'Primo') returning id into s;
 insert into public.stores(household_id,name) values(h,'Secondo') returning id into other_store;
 p:=(public.save_catalog_product('Prodotto fixture',p_quantity:=500,p_unit:='g')->>'id')::uuid;
 perform public.set_product_prices(p,s,20,15,'kg');
 perform public.set_product_prices(p,other_store,3,2,'package');
 body:=jsonb_build_object('p_id',p,'p_specific',true,'p_name','Prodotto aggiornato','p_quantity',250,'p_unit','g','p_brand','Marca');
 perform public.save_catalog_product_with_prices(body,s,22,16,'kg');
 if not exists(select 1 from public.specific_products where id=p and name='Prodotto aggiornato' and brand='Marca' and package_quantity=250) then raise exception 'Metadata not updated'; end if;
 if not exists(select 1 from public.product_prices where specific_product_id=p and store_id=s and price_amount=22 and discounted_price_amount=16) or
    not exists(select 1 from public.product_prices where specific_product_id=p and store_id=other_store and price_amount=3 and discounted_price_amount=2) then raise exception 'Wrong store changed'; end if;
 begin
  perform public.save_catalog_product_with_prices(body||'{"p_name":"Rollback errore"}',gen_random_uuid(),2,1,'kg');
  raise exception 'Foreign store accepted';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.generic_products where name='Rollback errore') or not exists(select 1 from public.specific_products where id=p and name='Prodotto aggiornato') then raise exception 'Partial metadata update'; end if;
 perform public.set_product_prices(p,other_store,25,20,'kg');
 begin
  perform public.save_catalog_product_with_prices(body||'{"p_unit":"ml"}',s,4,3,'l');
  raise exception 'Other store incompatible format accepted';
 exception when raise_exception then if sqlerrm not like 'Prezzo non valido:%' then raise; end if; end;
 if not exists(select 1 from public.product_prices where specific_product_id=p and store_id=s and price_amount=22 and discounted_price_amount=16) then raise exception 'Price not rolled back'; end if;
 perform public.set_product_prices(p,other_store,3,2,'package');
 perform public.save_catalog_product_with_prices(body||'{"p_unit":"ml"}',s,4,3,'l');
 if not exists(select 1 from public.specific_products where id=p and package_unit='ml') or not exists(select 1 from public.product_prices where specific_product_id=p and store_id=s and price_basis='l') then raise exception 'Atomic format/basis update failed'; end if;
 perform public.save_catalog_product_with_prices(body||'{"p_unit":"ml"}',s,null,null,'l');
 if exists(select 1 from public.product_prices where specific_product_id=p and store_id=s) or not exists(select 1 from public.product_prices where specific_product_id=p and store_id=other_store) then raise exception 'Clear affected other store'; end if;
 begin
  perform public.set_record_archived('specific_products',p,true);
  raise exception 'General archiving still allowed';
 exception when raise_exception then if sqlerrm<>'Accesso negato' then raise; end if; end;
 begin
  update public.specific_products set archived_at=now() where id=p;
  raise exception 'Direct archive accepted';
 exception when check_violation then null; end;
 l:=public.ensure_shopping_list(h);
 i:=public.add_list_item(l,'Elemento fixture',2,'pz');
 select version into v from public.shopping_lists where id=l;
 perform public.set_list_item_removed(i,true,v);
 if not exists(select 1 from public.shopping_list_items where id=i and archived_at is not null) then raise exception 'List removal failed'; end if;
 begin
  perform public.set_list_item_removed(i,false,v);
  raise exception 'Stale version accepted';
 exception when raise_exception then if sqlerrm not like 'Lista modificata:%' then raise; end if; end;
 select version into v from public.shopping_lists where id=l;
 perform public.set_record_archived('shopping_list_items',i,false,v);
 if not exists(select 1 from public.shopping_list_items where id=i and archived_at is null) then raise exception 'Legacy list restore failed'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin
  perform public.save_catalog_product_with_prices(body,s,1,0,'package');
  raise exception 'Foreign edit allowed';
 exception when raise_exception then if sqlerrm<>'Accesso negato' then raise; end if; end;
 begin
  perform public.set_list_item_removed(i,true,v);
  raise exception 'Foreign list removal allowed';
 exception when raise_exception then if sqlerrm<>'Accesso negato' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('save_catalog_product_with_prices','set_list_item_removed','set_record_archived') and (p.prosecdef or has_function_privilege('anon',p.oid,'execute'))) then raise exception 'Unsafe public function'; end if;
end $$;
rollback;
select 'PASS' as status,'Atomic catalog editing, prices, no archive, list removal and isolation verified' as verification;
