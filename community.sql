-- Motor's Events — communauté
-- Classement public des membres qui ont le plus d'événements approuvés.
-- La fonction reste SECURITY INVOKER afin que les RLS existantes s'appliquent.

CREATE OR REPLACE FUNCTION public.get_top_publishers(limit_count integer DEFAULT 6)
RETURNS TABLE (
  id uuid,
  display_name text,
  username text,
  city text,
  region text,
  avatar_url text,
  event_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.username,
    p.city,
    p.region,
    p.avatar_url,
    COUNT(e.id)::bigint AS event_count
  FROM public.profiles p
  JOIN public.events e
    ON e.user_id = p.id
   AND e.status = 'approved'
  GROUP BY p.id, p.display_name, p.username, p.city, p.region, p.avatar_url
  ORDER BY COUNT(e.id) DESC, COALESCE(p.display_name, p.username, '') ASC
  LIMIT LEAST(GREATEST(COALESCE(limit_count, 6), 1), 20);
$$;

GRANT EXECUTE ON FUNCTION public.get_top_publishers(integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
