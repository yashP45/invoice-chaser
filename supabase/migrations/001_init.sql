-- Enable extensions
create extension if not exists "uuid-ossp";

-- Users table
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  created_at timestamptz default now()
);

-- Keep users table in sync with auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enums
create type invoice_status as enum ('open', 'partial', 'paid', 'void');
create type reminder_status as enum ('queued', 'sent', 'failed');

-- Clients
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

create unique index if not exists clients_user_email_unique on public.clients(user_id, email);

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_number text not null,
  amount numeric not null,
  currency text default 'USD',
  issue_date date,
  due_date date not null,
  status invoice_status default 'open',
  last_reminder_sent_at timestamptz,
  created_at timestamptz default now()
);

create unique index if not exists invoices_user_number_unique on public.invoices(user_id, invoice_number);

-- Reminders
create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reminder_stage int not null,
  sent_at timestamptz,
  email_id text,
  status reminder_status default 'queued',
  created_at timestamptz default now()
);

-- Optional email events
create table if not exists public.email_events (
  id uuid primary key default uuid_generate_v4(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  event_type text not null,
  event_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.reminders enable row level security;
alter table public.email_events enable row level security;

create policy "Users can view their profile" on public.users
  for select using (id = auth.uid());

create policy "Users can manage their clients" on public.clients
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can manage their invoices" on public.invoices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can manage their reminders" on public.reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can manage their email events" on public.email_events
  for all using (exists (
    select 1 from public.reminders r
    where r.id = reminder_id and r.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.reminders r
    where r.id = reminder_id and r.user_id = auth.uid()
  ));
