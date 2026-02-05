# Invoice Chaser MVP (Next.js 16)

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

Optional: `currency`, `issue_date`, `status`, `subtotal`, `tax`, `total`,
`payment_terms`, `bill_to_address`

Line items (up to 5):
`item1_desc`, `item1_qty`, `item1_unit_price`, `item1_line_total` … `item5_*`

## Reminder Engine
Run via Dashboard button or call `POST /api/reminders/run`.

## Testing (Playwright)
```bash
npm test
```

## Deployment (Vercel)
1. Connect the GitHub repo to Vercel.
2. Add env vars from `.env.example` in Vercel Project Settings.
3. Deploy — Vercel handles CD on every push to `main`.

Optional: Set up a Vercel cron job to hit:
`POST /api/reminders/run` with the `CRON_SECRET` header.

## CI/CD
GitHub Actions workflow runs lint + Playwright on push/PR:
`.github/workflows/ci.yml`

## Security Notes
- Row Level Security enforced in Supabase migrations.
- Rate limiting added to reminder endpoints to reduce abuse.
