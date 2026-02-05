import Link from "next/link";

const FEATURES = [
  {
    title: "Overdue visibility",
    description: "See every past-due invoice, the amount, and days overdue at a glance."
  },
  {
    title: "Polite reminders",
    description: "Send friendly 7/14/21 day nudges that keep your relationships intact."
  },
  {
    title: "CSV-first setup",
    description: "Import your existing invoice exports in minutes. No new tooling."
  }
];

const AI_FEATURES = [
  {
    title: "AI invoice extraction",
    description:
      "Upload a PDF or image and auto-fill client, dates, totals, and line items."
  },
  {
    title: "AI reminder variants",
    description:
      "Generate polished subject/body options and use one for a full reminder run."
  },
  {
    title: "Confidence-aware review",
    description:
      "We show AI confidence so you know exactly what to double-check before saving."
  }
];

const STEPS = [
  {
    step: "1",
    title: "Upload invoices",
    description: "Import a CSV from QuickBooks, Xero, or your spreadsheet."
  },
  {
    step: "2",
    title: "Review aging",
    description: "See overdue totals and prioritize accounts to follow up."
  },
  {
    step: "3",
    title: "Run reminders",
    description: "Send polite emails on a steady cadence with one click."
  }
];

const TESTIMONIALS = [
  {
    name: "Rachel M.",
    role: "Agency owner",
    quote: "Invoice Chaser helped us clean up a $18k backlog in weeks."
  },
  {
    name: "Devon L.",
    role: "Consultant",
    quote: "The 7/14/21 reminders feel professional and get replies fast."
  }
];

export function Landing() {
  return (
    <div className="space-y-28">
      <section className="grid items-center gap-12 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div className="space-y-8">
          <div className="inline-flex items-center rounded-full border border-slate-200/60 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Invoice Chaser
          </div>
          <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
            Get paid faster without chasing people down.
          </h1>
          <p className="text-base text-slate-600">
            Import your invoices, surface what’s overdue, and send polished reminders in a
            proven 7/14/21 cadence. Built for SMBs who want cash flow without chaos.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link className="button" href="/signup">
              Start free
            </Link>
            <Link className="button-secondary" href="/login">
              Log in
            </Link>
          </div>
          <div className="flex flex-wrap gap-8 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              No billing in MVP
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              CSV import in minutes
            </div>
          </div>
        </div>
        <div className="card p-8">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">Overdue total</p>
              <p className="text-3xl font-semibold">$24,480</p>
              <p className="text-xs text-slate-500">Across 6 invoices</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">Next reminder</p>
              <p className="text-lg font-semibold">Bluehill Media — Stage 2</p>
              <p className="text-xs text-slate-500">Scheduled for today</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">Recent activity</p>
              <p className="text-sm text-slate-600">3 reminders sent this week</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="space-y-10 py-6">
        <div>
          <h2 className="text-3xl font-semibold">Everything you need to chase with confidence.</h2>
          <p className="text-slate-600">
            Stay professional, stay consistent, and keep your cash flow predictable.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card p-8">
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-slate-600 mt-2">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="ai" className="space-y-10 py-6">
        <div>
          <h2 className="text-3xl font-semibold">AI that saves you real time.</h2>
          <p className="text-slate-600">
            Let automation handle the tedious parts while you stay in control.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {AI_FEATURES.map((feature) => (
            <div key={feature.title} className="card p-8">
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-slate-600 mt-2">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="workflow"
        className="grid gap-8 py-6 md:grid-cols-[0.9fr_1.1fr] md:items-center"
      >
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold">A simple, repeatable workflow.</h2>
          <p className="text-slate-600">
            Get your weekly follow-up routine down to a single click.
          </p>
        </div>
        <div className="space-y-5">
          {STEPS.map((step) => (
            <div key={step.step} className="card flex items-start gap-4 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-semibold">
                {step.step}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-slate-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
{/* 
      <section id="testimonials" className="space-y-10 py-6">
        <div>
          <h2 className="text-3xl font-semibold">Trusted by cash-flow conscious teams.</h2>
          <p className="text-slate-600">
            Early users are already shortening payment cycles.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((testimonial) => (
            <div key={testimonial.name} className="card p-8">
              <p className="text-base text-slate-600">“{testimonial.quote}”</p>
              <p className="mt-4 text-sm font-semibold text-slate-700">
                {testimonial.name}
              </p>
              <p className="text-xs text-slate-500">{testimonial.role}</p>
            </div>
          ))}
        </div>
      </section> */}

      <section id="pricing" className="card p-10 text-center">
        <h2 className="text-3xl font-semibold">MVP pricing: free for now.</h2>
        <p className="mt-2 text-slate-600">
          We’re validating the product. Join early and help shape the roadmap.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="button" href="/signup">
            Create account
          </Link>
          <Link className="button-secondary" href="/login">
            Log in
          </Link>
        </div>
      </section>
    </div>
  );
}
