"use client";

import { useRef, useTransition } from "react";
import { ReminderTemplateFields, type ReminderTemplateFieldsRef } from "@/components/reminder-template-fields";
import { useToast } from "@/components/toast-provider";

type SettingsFormProps = {
  action: (formData: FormData) => Promise<void | { error?: string }>;
  defaultSubject: string;
  defaultBody: string;
  companyName?: string;
  senderName?: string;
  companyNameDefault: string;
  senderNameDefault: string;
  replyToDefault: string;
  builtinTokensList: string;
  customTokensList: string | null;
};

export function SettingsForm({
  action,
  defaultSubject,
  defaultBody,
  companyName,
  senderName,
  companyNameDefault,
  senderNameDefault,
  replyToDefault,
  builtinTokensList,
  customTokensList
}: SettingsFormProps) {
  const templateRef = useRef<ReminderTemplateFieldsRef>(null);
  const [isPending, startTransition] = useTransition();
  const { addToast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const subject = templateRef.current?.getSubject() ?? "";
    const body = templateRef.current?.getBody() ?? "";
    formData.set("reminder_template", JSON.stringify({ subject, body }));
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        addToast({
          title: "Settings could not be saved",
          description: result.error,
          variant: "error"
        });
      } else {
        addToast({
          title: "Settings saved",
          description: "Your reminder template and preferences were updated.",
          variant: "success"
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="company_name">
            Company name
          </label>
          <input
            id="company_name"
            name="company_name"
            className="input mt-1"
            defaultValue={companyNameDefault}
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
            defaultValue={senderNameDefault}
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
            defaultValue={replyToDefault}
          />
        </div>
      </div>

      <ReminderTemplateFields
        ref={templateRef}
        defaultSubject={defaultSubject}
        defaultBody={defaultBody}
        companyName={companyName}
        senderName={senderName}
      />
      <p className="text-xs text-slate-500">
        Built-in (always filled): {builtinTokensList || "—"}.
      </p>
      {customTokensList && (
        <p className="text-xs text-slate-500">Custom (AI or you fill): {customTokensList}.</p>
      )}

      <button type="submit" className="button" disabled={isPending}>
        {isPending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
