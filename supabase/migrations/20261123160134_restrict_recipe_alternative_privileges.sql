-- Supabase owner defaults may grant TRUNCATE, REFERENCES and TRIGGER as well as DML.
-- RLS does not protect TRUNCATE. Retain only the four API operations used by the app.
revoke all on table public.recipe_ingredient_alternatives from public,anon,authenticated;
grant select,insert,update,delete on table public.recipe_ingredient_alternatives to authenticated;
