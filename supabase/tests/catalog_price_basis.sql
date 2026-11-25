begin;
set local statement_timeout='30s';
create temporary table bulk_context(id uuid) on commit drop;
insert into bulk_context values(gen_random_uuid());
insert into auth.users(id,aud,role,email,created_at,updated_at) select id,'authenticated','authenticated','bulk-'||id||'@example.invalid',now(),now() from bulk_context;
select set_config('request.jwt.claim.sub',(select id::text from bulk_context),true);
set local role authenticated;
do $$
declare h uuid; s uuid; p uuid; before_count integer;
begin
 h:=public.create_household('Fixture prezzi sfusi');
 insert into public.stores(household_id,name) values(h,'Fixture negozio') returning id into s;
 p:=(public.create_catalog_product_with_price('{"p_name":"Affettato fixture"}',s,20,'kg')->>'id')::uuid;
 if not exists(select 1 from public.product_prices where specific_product_id=p and store_id=s and price_amount=20 and price_basis='kg') then raise exception 'Missing atomic price'; end if;
 before_count:=(select count(*) from public.specific_products);
 begin
  perform public.create_catalog_product_with_price('{"p_name":"Rollback formato","p_quantity":6,"p_unit":"pz"}',s,20,'kg');
  raise exception 'Incompatible format allowed';
 exception when raise_exception then if sqlerrm not like 'Prezzo non valido:%' then raise; end if; end;
 if (select count(*) from public.specific_products)<>before_count or exists(select 1 from public.generic_products where name='Rollback formato') then raise exception 'Partial product persisted'; end if;
 begin
  perform public.create_catalog_product_with_price('{"p_name":"Rollback negozio"}',gen_random_uuid(),2,'package');
  raise exception 'Invalid store allowed';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.specific_products)<>before_count then raise exception 'Partial invalid store'; end if;
 begin
  perform public.set_product_price_basis(p,s,'NaN'::numeric,'kg');
  raise exception 'NaN accepted';
 exception when raise_exception then if sqlerrm not like 'Prezzo non valido:%' then raise; end if; end;
 begin
  perform public.save_catalog_product('Affettato fixture',p_id:=p,p_specific:=true,p_quantity:=6,p_unit:='pz');
  raise exception 'Incompatible format update allowed';
 exception when raise_exception then if sqlerrm not like 'Prezzo non valido:%' then raise; end if; end;
 perform public.set_product_price(p,s,3);
 if not exists(select 1 from public.product_prices where specific_product_id=p and price_basis='package' and price_amount=3) then raise exception 'Legacy wrapper did not reset basis'; end if;
 perform public.set_product_price_basis(p,s,4,'l');
 if exists(select 1 from public.price_observations where specific_product_id=p) then raise exception 'Created price history'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin
  perform public.set_product_price_basis(p,s,9,'l');
  raise exception 'Foreign member allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.create_catalog_product_with_price(jsonb,uuid,numeric,text)','execute') or has_function_privilege('anon','public.set_product_price_basis(uuid,uuid,numeric,text)','execute') then raise exception 'Anonymous RPC exposed'; end if;
 if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in ('create_catalog_product_with_price','set_product_price_basis') and prosecdef) then raise exception 'Public definer exposed'; end if;
end $$;
rollback;
select 'PASS' as status,'Atomic creation, basis compatibility, legacy API, isolation and rollback verified' as verification;
