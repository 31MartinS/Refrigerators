-- Supabase installs pgcrypto in the extensions schema. The draw function
-- previously searched only public, so gen_random_bytes() could not be found.
alter function public.draw_prize_atomic(uuid, text)
set search_path to public, extensions;
