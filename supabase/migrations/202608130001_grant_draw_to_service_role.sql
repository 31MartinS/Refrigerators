-- The public cannot execute the draw RPC directly. Only Edge Functions,
-- which use the server-side service role, may invoke it.
revoke all on function public.draw_prize_atomic(uuid, text)
from public, anon, authenticated;

grant execute on function public.draw_prize_atomic(uuid, text)
to service_role;
