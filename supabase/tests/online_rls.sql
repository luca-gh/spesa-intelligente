/* spesa_online_rls_test: synthetic fixtures, rolled back before returning */
begin;
set local statement_timeout='20s';
create temporary table spesa_test_context(key text primary key,value text not null) on commit drop;
grant select,insert,update on spesa_test_context to authenticated;
insert into spesa_test_context values('alice',gen_random_uuid()::text),('bob',gen_random_uuid()::text),('eve',gen_random_uuid()::text),('operation',gen_random_uuid()::text);
insert into auth.users(id,aud,role,email,created_at,updated_at)
select value::uuid,'authenticated','authenticated','codex-test-'||value||'@example.invalid',now(),now()
from spesa_test_context where key in ('alice','bob','eve');

select set_config('request.jwt.claim.sub',(select value from spesa_test_context where key='alice'),true);
set local role authenticated;
insert into spesa_test_context select 'home_a',public.create_household('Fixture temporanea A')::text;
insert into spesa_test_context select 'invite',public.create_invite((select value::uuid from spesa_test_context where key='home_a'));
insert into spesa_test_context select 'list',public.ensure_shopping_list((select value::uuid from spesa_test_context where key='home_a'))::text;
do $$ begin
  if public.ensure_shopping_list((select value::uuid from spesa_test_context where key='home_a'))<>(select value::uuid from spesa_test_context where key='list') then
    raise exception 'Lista unica: inizializzazione non idempotente';
  end if;
  begin
    insert into public.shopping_lists(household_id,title) values((select value::uuid from spesa_test_context where key='home_a'),'Seconda lista');
    raise exception 'Lista unica: creazione aggiuntiva consentita';
  exception when unique_violation then null;
  end;
  begin
    perform public.duplicate_list((select value::uuid from spesa_test_context where key='list'));
    raise exception 'Lista unica: duplicazione consentita';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into spesa_test_context select 'item',public.add_list_item((select value::uuid from spesa_test_context where key='list'),'Articolo temporaneo',2,'pz')::text;
insert into spesa_test_context select 'catalog_product',public.save_catalog_product('Prodotto temporaneo catalogo')->>'id';
do $$
declare product uuid:=(select value::uuid from spesa_test_context where key='catalog_product'); result jsonb;
begin
  if not exists(select 1 from public.specific_products where id=product and brand='' and barcode is null and package_quantity is null and package_unit is null) then raise exception 'Solo nome: dati facoltativi inventati'; end if;
  result:=public.save_catalog_product('Prodotto temporaneo catalogo',p_brand:='Marca temporanea',p_barcode:='96385074',p_quantity:=1,p_unit:='L',p_id:=product,p_specific:=true);
  if result->>'id'<>product::text then raise exception 'Identità prodotto modificata'; end if;
  if not exists(select 1 from public.specific_products where id=product and package_quantity=1 and package_unit='L') then raise exception 'Formato non salvato'; end if;
  perform public.save_catalog_product('Prodotto temporaneo catalogo',p_id:=product,p_specific:=true);
  if not exists(select 1 from public.specific_products where id=product and barcode is null and package_quantity is null and package_unit is null) then raise exception 'Dettagli non rimossi'; end if;
end $$;

select set_config('request.jwt.claim.sub',(select value from spesa_test_context where key='bob'),true);
select public.accept_invite((select value from spesa_test_context where key='invite'));
do $$ begin
  if (select count(*) from public.shopping_lists)<>1 then raise exception 'Secondo membro: lettura fallita'; end if;
end $$;
select public.record_purchase((select value::uuid from spesa_test_context where key='operation'),(select value::uuid from spesa_test_context where key='item'),0.5);
select public.record_purchase((select value::uuid from spesa_test_context where key='operation'),(select value::uuid from spesa_test_context where key='item'),0.5);
do $$ begin
  if (select count(*) from public.purchases)<>1 then raise exception 'Idempotenza acquisti fallita'; end if;
  if (select sum(quantity) from public.purchases)<>0.5 then raise exception 'Quantita parziale non corretta'; end if;
  if exists(select 1 from public.purchases where total_paid is not null) then raise exception 'Prezzo fittizio creato'; end if;
end $$;

select set_config('request.jwt.claim.sub',(select value from spesa_test_context where key='eve'),true);
insert into spesa_test_context select 'home_b',public.create_household('Fixture temporanea B')::text;
do $$ begin
  if exists(select 1 from public.shopping_lists) or exists(select 1 from public.purchases) then raise exception 'Fuga dati tra famiglie'; end if;
  begin
    insert into public.shopping_lists(household_id,title) values((select value::uuid from spesa_test_context where key='home_a'),'Intrusione');
    raise exception 'Scrittura cross-family consentita';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.add_list_item((select value::uuid from spesa_test_context where key='list'),'Intrusione',1,'pz');
    raise exception 'RPC cross-family consentita';
  exception when raise_exception then
    if SQLERRM<>'Accesso negato' then raise; end if;
  end;
  begin
    perform public.save_catalog_product('Intrusione',p_id:=(select value::uuid from spesa_test_context where key='catalog_product'),p_specific:=true);
    raise exception 'Catalogo cross-family consentito';
  exception when raise_exception then
    if SQLERRM<>'Accesso negato' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub',(select value from spesa_test_context where key='bob'),true);
select public.leave_household((select value::uuid from spesa_test_context where key='home_a'));
do $$ begin
  if exists(select 1 from public.shopping_lists) or exists(select 1 from public.purchases) then raise exception 'Accesso conservato dopo uscita'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.save_catalog_product('Anon');
    raise exception 'Catalogo anon consentito';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_household('Anon');
    raise exception 'RPC anon consentita';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.shopping_lists;
    raise exception 'Lettura anon consentita';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'PASS' as status,'Due membri, isolamento famiglie, acquisto parziale idempotente, uscita e anon verificati; fixture annullate' as verification;
