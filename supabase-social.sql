-- Motor's Events — social / wishlist migration
-- Run this ONCE after the base schema is already installed.

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows(following_id);
create index if not exists follows_follower_id_idx on public.follows(follower_id);

alter table public.follows enable row level security;

revoke all on public.follows from anon, authenticated;
grant select, insert, delete on public.follows to authenticated;

drop policy if exists "Users can read their follows" on public.follows;
create policy "Users can read their follows"
on public.follows for select
to authenticated
using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);

drop policy if exists "Users can follow members" on public.follows;
create policy "Users can follow members"
on public.follows for insert
to authenticated
with check ((select auth.uid()) = follower_id and follower_id <> following_id);

drop policy if exists "Users can unfollow members" on public.follows;
create policy "Users can unfollow members"
on public.follows for delete
to authenticated
using ((select auth.uid()) = follower_id);

-- Public read access is intentionally NOT granted to the follows table.
-- Follower/following totals are queried with exact counts under authenticated RLS.

notify pgrst, 'reload schema';

-- Public follower/following totals without exposing the relationship rows.
create or replace function public.get_follow_counts(target_user uuid)
returns table(followers bigint, following bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.follows where following_id = target_user),
    (select count(*) from public.follows where follower_id = target_user);
$$;

revoke all on function public.get_follow_counts(uuid) from public;
grant execute on function public.get_follow_counts(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
