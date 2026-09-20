-- Motor's Events — Supabase schema
-- Run this whole file once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'Membre Motor''s Events',
  bio text not null default '' check (char_length(bio) <= 500),
  city text not null default '' check (char_length(city) <= 120),
  region text not null default '' check (char_length(region) <= 120),
  website text not null default '' check (char_length(website) <= 300),
  avatar_url text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in ('auto','moto','quad','truck','nautisme','aviation')),
  subtype text not null check (char_length(subtype) between 1 and 80),
  start_date date not null,
  end_date date,
  place text not null check (char_length(place) between 2 and 200),
  city text not null default '' check (char_length(city) <= 120),
  region text not null default '' check (char_length(region) <= 120),
  description text not null check (char_length(description) between 20 and 5000),
  official_url text,
  image_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates_valid check (end_date is null or end_date >= start_date)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id bigint not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists events_user_id_idx on public.events(user_id);
create index if not exists events_status_date_idx on public.events(status, start_date);
create index if not exists favorites_event_id_idx on public.favorites(event_id);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function private.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin','moderator')
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_moderator() from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_moderator() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'username',''), 30), ''),
    coalesce(nullif(left(new.raw_user_meta_data ->> 'display_name', 100), ''), 'Membre Motor''s Events')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
before update on public.events
for each row execute procedure public.touch_updated_at();

-- A normal organizer can never promote their own event to approved.
-- Any edit they make puts the event back into moderation.
create or replace function public.protect_event_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_moderator() and (select auth.uid()) = old.user_id then
    new.status = 'pending';
    new.rejection_reason = null;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_status on public.events;
create trigger protect_event_status
before update on public.events
for each row execute procedure public.protect_event_status();

drop trigger if exists protect_profile_role on public.profiles;
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    new.role = old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before update on public.profiles
for each row execute procedure public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.favorites enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.events from anon, authenticated;
revoke all on public.favorites from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, delete on public.favorites to authenticated;

grant usage, select on sequence public.events_id_seq to authenticated;

-- Profiles: public profile data is readable, but only the owner/admin can modify it.
drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or (select private.is_admin()))
with check ((select auth.uid()) = id or (select private.is_admin()));

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
on public.profiles for delete
to authenticated
using ((select private.is_admin()));

-- Events: visitors see approved events only. Owners see their own moderation states.
drop policy if exists "Anyone can read approved events" on public.events;
create policy "Anyone can read approved events"
on public.events for select
to anon, authenticated
using (status = 'approved' or (select auth.uid()) = user_id or (select private.is_moderator()));

drop policy if exists "Authenticated users can submit events" on public.events;
create policy "Authenticated users can submit events"
on public.events for insert
to authenticated
with check ((select auth.uid()) = user_id and status = 'pending');

drop policy if exists "Owners can edit their events" on public.events;
create policy "Owners can edit their events"
on public.events for update
to authenticated
using ((select auth.uid()) = user_id or (select private.is_moderator()))
with check (
  (select private.is_moderator())
  or ((select auth.uid()) = user_id and status in ('pending','rejected'))
);

drop policy if exists "Owners can delete their events" on public.events;
create policy "Owners can delete their events"
on public.events for delete
to authenticated
using ((select auth.uid()) = user_id or (select private.is_moderator()));

-- Favorites are strictly private to their owner.
drop policy if exists "Users can read their favorites" on public.favorites;
create policy "Users can read their favorites"
on public.favorites for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their favorites" on public.favorites;
create policy "Users can add their favorites"
on public.favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their favorites" on public.favorites;
create policy "Users can remove their favorites"
on public.favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Public buckets for profile/event imagery. Upload/delete remain protected by RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('event-images', 'event-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Users can upload only inside their own UUID folder.
drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text))
with check (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));

drop policy if exists "Users delete own avatars" on storage.objects;
create policy "Users delete own avatars"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));

drop policy if exists "Users upload own event images" on storage.objects;
create policy "Users upload own event images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users update own event images" on storage.objects;
create policy "Users update own event images"
on storage.objects for update
to authenticated
using (bucket_id = 'event-images' and owner_id = (select auth.uid()::text))
with check (bucket_id = 'event-images' and owner_id = (select auth.uid()::text));

drop policy if exists "Users delete own event images" on storage.objects;
create policy "Users delete own event images"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-images' and owner_id = (select auth.uid()::text));
