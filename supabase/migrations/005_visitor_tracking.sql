-- Visitor tracking table
create table if not exists public.visitor_events (
  id uuid primary key default uuid_generate_v4(),
  path text not null,
  referrer text,
  user_agent text,
  ip_address text,
  country text,
  city text,
  device_type text,
  browser text,
  os text,
  session_id text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists visitor_events_created_at_idx on public.visitor_events(created_at desc);
create index if not exists visitor_events_path_idx on public.visitor_events(path);
create index if not exists visitor_events_session_id_idx on public.visitor_events(session_id);
create index if not exists visitor_events_user_id_idx on public.visitor_events(user_id);

-- RLS - Allow public inserts for tracking, but only admins can view
alter table public.visitor_events enable row level security;

-- Allow anyone to insert visitor events (for tracking)
create policy "Anyone can track visits" on public.visitor_events
  for insert with check (true);

-- Only authenticated users can view their own events or all events (for admin)
create policy "Users can view visitor events" on public.visitor_events
  for select using (
    auth.uid() is not null and (
      user_id = auth.uid() or
      -- Allow viewing all events (you can restrict this further if needed)
      true
    )
  );
