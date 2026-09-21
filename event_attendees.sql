-- À exécuter une seule fois dans Supabase > SQL Editor
create table if not exists public.event_attendees (
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_attendees enable row level security;

create policy "Participants visibles par les utilisateurs connectés"
on public.event_attendees for select
to authenticated
using (true);

create policy "Un utilisateur peut participer"
on public.event_attendees for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Un utilisateur peut retirer sa participation"
on public.event_attendees for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists event_attendees_event_id_idx
on public.event_attendees(event_id);

create index if not exists event_attendees_user_id_idx
on public.event_attendees(user_id);
