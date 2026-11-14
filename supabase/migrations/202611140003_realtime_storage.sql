-- Kept separate so the core schema is testable on vanilla PostgreSQL/PGlite.
alter publication supabase_realtime add table public.shopping_lists,public.shopping_list_items,public.list_item_contributions,public.purchases;
-- No image upload is enabled yet. Do not create a public bucket for family photos.
