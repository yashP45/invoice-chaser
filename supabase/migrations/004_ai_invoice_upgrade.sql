-- Invoices additions
alter table public.invoices add column if not exists subtotal numeric;
alter table public.invoices add column if not exists tax numeric;
alter table public.invoices add column if not exists total numeric;
alter table public.invoices add column if not exists payment_terms text;
alter table public.invoices add column if not exists bill_to_address text;
alter table public.invoices add column if not exists ai_extracted boolean default false;
alter table public.invoices add column if not exists ai_confidence numeric;
alter table public.invoices add column if not exists extracted_at timestamptz;
alter table public.invoices add column if not exists source_file_path text;

-- Line items
create table if not exists public.invoice_line_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text,
  quantity numeric,
  unit_price numeric,
  line_total numeric,
  position int,
  created_at timestamptz default now()
);

-- Invoice files
create table if not exists public.invoice_files (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size bigint,
  ai_confidence numeric,
  created_at timestamptz default now()
);

-- RLS
alter table public.invoice_line_items enable row level security;
alter table public.invoice_files enable row level security;

create policy "Users can manage their line items" on public.invoice_line_items
  for all using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.user_id = auth.uid()
  ));

create policy "Users can manage their invoice files" on public.invoice_files
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
