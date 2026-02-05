# Invoice Chaser MVP (Next.js 16)

Simple SaaS to import invoices, track overdue status, and send polite reminders.

**Live demo:** (https://invoicechaserr.siteagentify.com/)

## Setup

1. Install deps:
   ```bash
   npm install
   ```
2. Create `.env.local` from `.env.example` with your Supabase + Resend keys.
3. Apply Supabase migrations in order:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_add_full_name.sql`
   - `supabase/migrations/003_add_settings_and_paid_at.sql`
   - `supabase/migrations/004_ai_invoice_upgrade.sql`
4. Run:
   ```bash
   npm run dev
   ```

## Sample Files (Upload + Test)
Use these to quickly test CSV import and AI invoice parsing.

**CSV templates**
- Download template: `/templates/invoice_template.csv`
- Repo file: `public/templates/invoice_template.csv`

**CSV samples**
- `test-data/sample_basic.csv`
- `test-data/sample_aliases.csv`
- `test-data/sample_line_items.csv`

**PDF samples (AI extraction)**
- `test-data/invoice_sample_1.pdf`
- `test-data/invoice_sample_2.pdf`

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
