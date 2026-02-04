export const DEFAULT_SUBJECT =
  "Friendly reminder: Invoice {{invoice_number}} is {{days_overdue}} days past due";

export const DEFAULT_BODY = `Hi {{client_name}},\n\nThis is a friendly reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}} and is now {{days_overdue}} days past due.\n\nIf you’ve already sent payment, please disregard this note. Otherwise, could you let us know when we can expect payment?\n\nThanks,\n{{sender_name}}\n{{company_name}}`;

export function renderTemplate(template: string, data: Record<string, string | number>) {
  return Object.entries(data).reduce((result, [key, value]) => {
    const token = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    return result.replace(token, String(value ?? ""));
  }, template);
}
