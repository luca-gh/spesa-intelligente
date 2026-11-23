-- Cover the composite store FK and avoid evaluating the same SELECT policy twice.
create index store_category_order_store_household on public.store_category_order(store_id,household_id);
drop policy member_read on public.store_category_order;
