# Invoice Chaser MVP

Simple SaaS to import invoices, track overdue status, and send polite reminders.

## Setup

1. Install deps:
   ```bash
   npm install
   ```
2. Create `.env.local` from `.env.example` with your Supabase + Resend keys.
3. Apply Supabase migration in `supabase/migrations/001_init.sql`.
4. Run:
   ```bash
   npm run dev
   ```

## CSV Format
Required columns (case-insensitive):
`invoice_number`, `client_name`, `client_email`, `amount`, `due_date`

Optional: `currency`, `issue_date`, `status`

## Reminder Engine
Run via Dashboard button or call `POST /api/reminders/run`.
