alter table public.users add column if not exists company_name text;
alter table public.users add column if not exists sender_name text;
alter table public.users add column if not exists reply_to text;
alter table public.users add column if not exists reminder_subject text;
alter table public.users add column if not exists reminder_body text;

alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists updated_at timestamptz default now();

create or replace function public.handle_invoice_updated()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_invoice_updated on public.invoices;
create trigger on_invoice_updated
  before update on public.invoices
  for each row execute procedure public.handle_invoice_updated();
