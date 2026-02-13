import { redirect } from "next/navigation";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import { updateUserSettings } from "@/lib/actions";
import { DEFAULT_BODY, DEFAULT_SUBJECT, BUILTIN_TOKEN_KEYS } from "@/lib/email/templates";
import { listTokens } from "@/lib/email/template-schema";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data: settings } = await supabase
    .from("users")
    .select("company_name, sender_name, reply_to, reminder_subject, reminder_body")
    .eq("id", user.id)
    .maybeSingle();

  const defaultSubject = settings?.reminder_subject ?? DEFAULT_SUBJECT;
  const defaultBody = settings?.reminder_body ?? DEFAULT_BODY;
  const { builtin, custom } = listTokens(defaultSubject, defaultBody, BUILTIN_TOKEN_KEYS);
  const builtinTokensList = builtin.map((k) => `{{${k}}}`).join(", ");
  const customTokensList = custom.length ? custom.map((k) => `{{${k}}}`).join(", ") : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-600">
          Customize your reminder templates and brand voice.
        </p>
      </div>

      <SettingsForm
        action={updateUserSettings}
        defaultSubject={defaultSubject}
        defaultBody={defaultBody}
        companyName={settings?.company_name ?? undefined}
        senderName={settings?.sender_name ?? undefined}
        companyNameDefault={settings?.company_name ?? ""}
        senderNameDefault={settings?.sender_name ?? ""}
        replyToDefault={settings?.reply_to ?? ""}
        builtinTokensList={builtinTokensList}
        customTokensList={customTokensList}
      />
    </div>
  );
}
