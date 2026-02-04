import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { updateUserSettings } from "@/lib/actions";
import { DEFAULT_BODY, DEFAULT_SUBJECT, renderTemplate } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
  const { data: settings } = await supabase
    .from("users")
    .select("company_name, sender_name, reply_to, reminder_subject, reminder_body")
    .eq("id", user.id)
    .maybeSingle();

  const previewData = {
    client_name: "Bluehill Media",
    invoice_number: "INV-2401",
    amount: "USD 1,250.00",
    due_date: "Jan 15, 2026",
    days_overdue: 14,
    sender_name: settings?.sender_name || user.user_metadata?.full_name || "Accounts",
    company_name: settings?.company_name || "Your Company"
  };

  const previewSubject = renderTemplate(
    settings?.reminder_subject || DEFAULT_SUBJECT,
    previewData
  );
  const previewBody = renderTemplate(
    settings?.reminder_body || DEFAULT_BODY,
    previewData
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-600">
          Customize your reminder templates and brand voice.
        </p>
      </div>

      <form action={updateUserSettings} className="card space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="company_name">
              Company name
            </label>
            <input
              id="company_name"
              name="company_name"
              className="input mt-1"
              defaultValue={settings?.company_name || ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="sender_name">
              Sender name
            </label>
            <input
              id="sender_name"
              name="sender_name"
              className="input mt-1"
              defaultValue={settings?.sender_name || ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="reply_to">
              Reply-to email
            </label>
            <input
              id="reply_to"
              name="reply_to"
              className="input mt-1"
              type="email"
              defaultValue={settings?.reply_to || ""}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="reminder_subject">
            Reminder subject
          </label>
          <input
            id="reminder_subject"
            name="reminder_subject"
            className="input mt-1"
            defaultValue={settings?.reminder_subject || DEFAULT_SUBJECT}
          />
        </div>

        <div>
          <label className="label" htmlFor="reminder_body">
            Reminder body
          </label>
          <textarea
            id="reminder_body"
            name="reminder_body"
            className="input mt-1 min-h-[220px]"
            defaultValue={settings?.reminder_body || DEFAULT_BODY}
          />
          <p className="mt-2 text-xs text-slate-500">
            Available tokens: {{`{{client_name}}`}}, {{`{{invoice_number}}`}},
            {{`{{amount}}`}}, {{`{{due_date}}`}}, {{`{{days_overdue}}`}},
            {{`{{sender_name}}`}}, {{`{{company_name}}`}}.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">{previewSubject}</p>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
            {previewBody}
          </pre>
        </div>

        <button className="button" type="submit">
          Save settings
        </button>
      </form>
    </div>
  );
}
