-- PostgreSQL 15+, compatible with Supabase. No production seed or private data.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 1 and 120),
  default_diners integer not null default 2 check (default_diners between 1 and 100),
  timezone text not null default 'Europe/Rome' check (timezone in ('Europe/Rome','Europe/London','UTC')),
  created_at timestamptz not null default now()
);
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', created_at timestamptz not null default now());
create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id), status text not null default 'active' check (status in ('active','left')),
  joined_at timestamptz not null default now(), primary key(household_id,user_id)
);
create unique index one_active_household on public.household_members(user_id) where status = 'active';
create table public.household_invites (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  token_hash text not null unique, expires_at timestamptz not null default now() + interval '2 days',
  accepted_at timestamptz, revoked_at timestamptz, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create function private.is_member(h uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.household_members where household_id=h and user_id=auth.uid() and status='active');
$$;
revoke all on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check(length(name) between 1 and 100), sort_order integer not null default 0,
  unique(id,household_id), unique(household_id,name)
);
create table public.generic_products (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check(length(name) between 1 and 200), category_id uuid,
  canonical_unit text not null check(canonical_unit in ('g','kg','ml','L','pz','conf')),
  aliases text[] not null default '{}', attributes_json jsonb not null default '{}', unique(id,household_id),
  foreign key(category_id,household_id) references public.categories(id,household_id), unique(household_id,name)
);
create table public.specific_products (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  generic_product_id uuid, name text not null check(length(name) between 1 and 200), brand text not null default '', variant text not null default '',
  package_quantity numeric(14,3) not null check(package_quantity > 0), package_unit text not null check(package_unit in ('g','kg','ml','L','pz','conf')),
  barcode text check(barcode ~ '^(\d{8}|\d{13})$'), aliases text[] not null default '{}', attributes_json jsonb not null default '{}', unique(id,household_id),
  foreign key(generic_product_id,household_id) references public.generic_products(id,household_id), unique(household_id,barcode)
);
create table public.stores (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  chain text not null default '', name text not null check(length(name) between 1 and 200), address text not null default '', city text not null default '',
  archived_at timestamptz, unique(id,household_id)
);
create table public.price_observations (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  specific_product_id uuid not null, store_id uuid not null, price_amount numeric(14,2) not null check(price_amount>=0),
  price_basis text not null default 'package' check(price_basis='package'), kind text not null check(kind in ('regular','promotion','unknown')),
  observed_at timestamptz not null default now(), promotion_starts_at date, promotion_ends_at date,
  source text not null default 'manual' check(source in ('manual','purchase','receipt')), source_id uuid, notes text not null default '',
  voided_at timestamptz, created_by uuid not null default auth.uid() references auth.users(id),
  foreign key(specific_product_id,household_id) references public.specific_products(id,household_id),
  foreign key(store_id,household_id) references public.stores(id,household_id),
  check(promotion_ends_at is null or (promotion_starts_at is not null and promotion_ends_at>=promotion_starts_at))
);
create index prices_lookup on public.price_observations(household_id,store_id,specific_product_id,observed_at desc);
create table public.store_discount_rules (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade, store_id uuid not null,
  name text not null check(length(name) between 1 and 200), percentage numeric(5,2) not null check(percentage between 0 and 100),
  weekdays integer[] not null check(weekdays <@ array[0,1,2,3,4,5,6]), valid_from date not null, valid_to date,
  active boolean not null default true, confirmed boolean not null default false,
  exclude_promotional_items boolean not null default true, priority integer not null default 0,
  minimum_total numeric(14,2) not null default 0 check(minimum_total>=0), maximum_discount numeric(14,2) check(maximum_discount>=0),
  excluded_product_ids uuid[] not null default '{}', conditions_note text not null default '', created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(), foreign key(store_id,household_id) references public.stores(id,household_id),
  check(valid_to is null or valid_to>=valid_from)
);
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  title text not null check(length(title) between 1 and 200), status text not null default 'active' check(status in ('active','completed','archived')),
  associated_week_start date, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,household_id)
);
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade, list_id uuid not null,
  generic_product_id uuid, specific_product_id uuid, name text not null check(length(name) between 1 and 200),
  unit text not null check(unit in ('g','kg','ml','L','pz','conf')), note text not null default '', sort_order integer not null default 0,
  created_at timestamptz not null default now(), unique(id,household_id),
  check(num_nonnulls(generic_product_id,specific_product_id)<=1),
  foreign key(list_id,household_id) references public.shopping_lists(id,household_id),
  foreign key(generic_product_id,household_id) references public.generic_products(id,household_id),
  foreign key(specific_product_id,household_id) references public.specific_products(id,household_id)
);
create index list_items_list on public.shopping_list_items(list_id,sort_order,created_at,id);
create table public.list_item_contributions (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade, item_id uuid not null,
  origin_type text not null check(origin_type in ('manual','recipe','plan')), origin_id uuid not null,
  requested_quantity numeric(14,3) not null check(requested_quantity>=0), unique(item_id,origin_type,origin_id),
  foreign key(item_id,household_id) references public.shopping_list_items(id,household_id) on delete cascade
);
create table public.purchases (
  id uuid primary key, household_id uuid not null references public.households(id) on delete cascade, list_item_id uuid not null,
  specific_product_id uuid, store_id uuid, quantity numeric(14,3) not null check(quantity>0), unit text not null check(unit in ('g','kg','ml','L','pz','conf')),
  total_paid numeric(14,2) check(total_paid>=0), gross_paid numeric(14,2), discount_paid numeric(14,2),
  purchased_at timestamptz not null default now(), promotional boolean, source text not null default 'manual' check(source in ('manual','receipt')),
  source_id uuid, voided_at timestamptz, created_by uuid not null default auth.uid() references auth.users(id),
  foreign key(list_item_id,household_id) references public.shopping_list_items(id,household_id),
  foreign key(specific_product_id,household_id) references public.specific_products(id,household_id),
  foreign key(store_id,household_id) references public.stores(id,household_id),
  check(gross_paid is null or (gross_paid>=0 and discount_paid>=0 and total_paid=gross_paid-discount_paid))
);
create index purchases_date on public.purchases(household_id,purchased_at);
create table public.recipes (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  title text not null check(length(title) between 1 and 200), base_servings integer not null check(base_servings>0),
  instructions text not null default '', notes text not null default '', source_url text check(source_url ~ '^https?://'),
  prep_minutes integer check(prep_minutes>=0), cook_minutes integer check(cook_minutes>=0), is_favorite boolean not null default false,
  created_at timestamptz not null default now(), unique(id,household_id)
);
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null, generic_product_id uuid not null, quantity numeric(14,3) not null check(quantity>0), unit text not null check(unit in ('g','kg','ml','L','pz','conf')),
  foreign key(recipe_id,household_id) references public.recipes(id,household_id) on delete cascade,
  foreign key(generic_product_id,household_id) references public.generic_products(id,household_id)
);
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null check(extract(isodow from week_start)=1), linked_list_id uuid, version integer not null default 1,
  unique(id,household_id), unique(household_id,week_start), foreign key(linked_list_id,household_id) references public.shopping_lists(id,household_id)
);
create table public.meal_entries (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  meal_plan_id uuid not null, meal_date date not null, meal_slot text not null check(meal_slot in ('colazione','pranzo','cena','spuntino')),
  recipe_id uuid, generic_product_id uuid, quantity numeric(14,3) check(quantity>0), unit text check(unit in ('g','kg','ml','L','pz','conf')), servings_override integer check(servings_override>0),
  check(num_nonnulls(recipe_id,generic_product_id)=1), check(generic_product_id is null or (quantity is not null and unit is not null)),
  foreign key(meal_plan_id,household_id) references public.meal_plans(id,household_id) on delete cascade,
  foreign key(recipe_id,household_id) references public.recipes(id,household_id),
  foreign key(generic_product_id,household_id) references public.generic_products(id,household_id)
);
create table public.meal_templates (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check(length(name) between 1 and 200), entries_json jsonb not null check(jsonb_typeof(entries_json)='array')
);
create table public.price_estimate_snapshots (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid not null, store_id uuid not null, estimated_total numeric(14,2) not null check(estimated_total>=0), coverage numeric not null check(coverage between 0 and 1),
  shopping_date date not null, created_at timestamptz not null default now(), detail_json jsonb not null,
  foreign key(list_id,household_id) references public.shopping_lists(id,household_id), foreign key(store_id,household_id) references public.stores(id,household_id)
);

-- All family tables are protected. Composite foreign keys also block cross-family references.
do $$ declare t text; begin
  foreach t in array array['categories','generic_products','specific_products','stores','price_observations','store_discount_rules','shopping_lists','shopping_list_items','list_item_contributions','purchases','recipes','recipe_ingredients','meal_plans','meal_entries','meal_templates','price_estimate_snapshots'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create index on public.%I(household_id)',t);
    execute format('create policy member_read on public.%I for select to authenticated using (private.is_member(household_id))',t);
    if t not in ('shopping_list_items','list_item_contributions','purchases','price_estimate_snapshots','price_observations') then
      execute format('create policy member_write on public.%I for all to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id))',t);
      execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    else
      execute format('grant select on public.%I to authenticated',t);
    end if;
  end loop;
end $$;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.profiles enable row level security;
create policy household_read on public.households for select to authenticated using(private.is_member(id));
create policy household_update on public.households for update to authenticated using(private.is_member(id)) with check(private.is_member(id));
create policy members_read on public.household_members for select to authenticated using(private.is_member(household_id));
create policy invites_read on public.household_invites for select to authenticated using(private.is_member(household_id));
create policy own_profile on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant select,update on public.households to authenticated;
grant select on public.household_members,public.household_invites to authenticated;
grant select,insert,update,delete on public.profiles to authenticated;

create function public.create_household(p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; begin
  if auth.uid() is null then raise exception 'Autenticazione richiesta'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if exists(select 1 from public.household_members where user_id=auth.uid() and status='active') then raise exception 'Hai già una famiglia'; end if;
  insert into public.households(name) values(trim(p_name)) returning id into h;
  insert into public.household_members(household_id,user_id) values(h,auth.uid());
  insert into public.categories(household_id,name,sort_order) values(h,'Altri prodotti',999);
  return h;
end $$;
create function public.create_invite(p_household uuid) returns text language plpgsql security definer set search_path='' as $$
declare token text; begin
  if not private.is_member(p_household) then raise exception 'Accesso negato'; end if;
  if (select count(*) from public.household_invites where household_id=p_household and created_at>now()-interval '1 day')>=20 then raise exception 'Limite inviti raggiunto'; end if;
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into public.household_invites(household_id,token_hash,created_by) values(p_household,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid());
  return token;
end $$;
create function public.accept_invite(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.household_invites; begin
  if auth.uid() is null or length(p_token)<>64 then raise exception 'Invito non valido o scaduto'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if exists(select 1 from public.household_members where user_id=auth.uid() and status='active') then raise exception 'Hai già una famiglia'; end if;
  select * into invitation from public.household_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if invitation.id is null or invitation.expires_at<=now() or invitation.accepted_at is not null or invitation.revoked_at is not null then raise exception 'Invito non valido o scaduto'; end if;
  insert into public.household_members(household_id,user_id) values(invitation.household_id,auth.uid()) on conflict(household_id,user_id) do update set status='active', joined_at=now();
  update public.household_invites set accepted_at=now() where id=invitation.id;
  return invitation.household_id;
end $$;
create function public.revoke_invite(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
  update public.household_invites set revoked_at=now() where id=p_id and private.is_member(household_id);
end $$;
create function public.leave_household(p_household uuid) returns void language plpgsql security definer set search_path='' as $$ begin
  perform 1 from public.households where id=p_household for update;
  if not private.is_member(p_household) then raise exception 'Accesso negato'; end if;
  if (select count(*) from public.household_members where household_id=p_household and status='active')<=1 then raise exception 'Ultimo membro: esporta e cancella la famiglia prima di uscire'; end if;
  update public.household_members set status='left' where household_id=p_household and user_id=auth.uid();
  update public.household_invites set revoked_at=now() where household_id=p_household and created_by=auth.uid() and accepted_at is null and revoked_at is null;
end $$;

-- List changes and purchase writes serialize on the list row.
create function public.add_list_item(p_list uuid,p_name text,p_quantity numeric,p_unit text,p_generic uuid default null,p_specific uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare l public.shopping_lists; item uuid; begin
  select * into l from public.shopping_lists where id=p_list for update;
  if not private.is_member(l.household_id) then raise exception 'Accesso negato'; end if;
  if p_quantity<=0 then raise exception 'Quantità non valida'; end if;
  insert into public.shopping_list_items(household_id,list_id,name,unit,generic_product_id,specific_product_id) values(l.household_id,p_list,trim(p_name),p_unit,p_generic,p_specific) returning id into item;
  insert into public.list_item_contributions(household_id,item_id,origin_type,origin_id,requested_quantity) values(l.household_id,item,'manual',item,p_quantity);
  update public.shopping_lists set version=version+1,updated_at=now() where id=p_list;
  return item;
end $$;
create function public.record_purchase(p_id uuid,p_item uuid,p_quantity numeric,p_total numeric default null,p_store uuid default null,p_specific uuid default null,p_promotional boolean default null,p_date timestamptz default now(),p_gross numeric default null) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.shopping_list_items; previous public.purchases; begin
  select * into item from public.shopping_list_items where id=p_item;
  if not private.is_member(item.household_id) then raise exception 'Accesso negato'; end if;
  perform 1 from public.shopping_lists where id=item.list_id for update;
  if p_specific is not null and ((item.specific_product_id is not null and item.specific_product_id<>p_specific) or (item.generic_product_id is not null and not exists(select 1 from public.specific_products where id=p_specific and generic_product_id=item.generic_product_id and household_id=item.household_id))) then raise exception 'Prodotto non equivalente: correggi esplicitamente il catalogo'; end if;
  select * into previous from public.purchases where id=p_id;
  if previous.id is not null then
    if previous.household_id<>item.household_id or previous.list_item_id<>p_item or previous.quantity<>p_quantity or previous.total_paid is distinct from p_total or previous.store_id is distinct from p_store or previous.specific_product_id is distinct from p_specific or previous.promotional is distinct from p_promotional then raise exception 'Chiave già usata con dati diversi'; end if;
    return previous.id;
  end if;
  insert into public.purchases(id,household_id,list_item_id,quantity,unit,total_paid,gross_paid,discount_paid,store_id,specific_product_id,promotional,purchased_at)
    values(p_id,item.household_id,p_item,p_quantity,item.unit,p_total,p_gross,case when p_gross is null then null else p_gross-p_total end,p_store,p_specific,p_promotional,p_date);
  -- No automatic price observation: paid amounts cannot establish promotion/regular classification or package basis.
  update public.shopping_lists set version=version+1,updated_at=now() where id=item.list_id;
  return p_id;
end $$;
create function public.void_purchase(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare purchase public.purchases; begin
  select * into purchase from public.purchases where id=p_id;
  if not private.is_member(purchase.household_id) then raise exception 'Accesso negato'; end if;
  perform 1 from public.shopping_lists where id=(select list_id from public.shopping_list_items where id=purchase.list_item_id) for update;
  update public.purchases set voided_at=coalesce(voided_at,now()) where id=p_id;
  update public.shopping_lists set version=version+1,updated_at=now() where id=(select list_id from public.shopping_list_items where id=purchase.list_item_id);
end $$;
create function public.complete_purchase_price(p_id uuid,p_total numeric) returns void language plpgsql security definer set search_path='' as $$ begin
  if p_total<0 then raise exception 'Importo non valido'; end if;
  update public.purchases set total_paid=p_total where id=p_id and private.is_member(household_id) and total_paid is null and voided_at is null;
  if not found then raise exception 'Acquisto non modificabile'; end if;
end $$;
create function public.add_price(p_product uuid,p_store uuid,p_amount numeric,p_kind text,p_observed timestamptz,p_start date default null,p_end date default null) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; result uuid; begin
  select household_id into h from public.specific_products where id=p_product;
  if not private.is_member(h) then raise exception 'Accesso negato'; end if;
  insert into public.price_observations(household_id,specific_product_id,store_id,price_amount,kind,observed_at,promotion_starts_at,promotion_ends_at)
    values(h,p_product,p_store,p_amount,p_kind,p_observed,p_start,p_end) returning id into result;
  return result;
end $$;
create function public.void_price(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
  update public.price_observations set voided_at=coalesce(voided_at,now()) where id=p_id and private.is_member(household_id);
end $$;
create function public.save_estimate(p_list uuid,p_store uuid,p_total numeric,p_coverage numeric,p_date date,p_detail jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; result uuid; begin
  select household_id into h from public.shopping_lists where id=p_list;
  if not private.is_member(h) then raise exception 'Accesso negato'; end if;
  insert into public.price_estimate_snapshots(household_id,list_id,store_id,estimated_total,coverage,shopping_date,detail_json) values(h,p_list,p_store,p_total,p_coverage,p_date,p_detail) returning id into result;
  return result;
end $$;

-- Harden every RPC: no anonymous execution, fixed search_path, explicit membership checks.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
    execute format('revoke all on function %s from public',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
