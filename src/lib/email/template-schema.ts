import { z } from "zod";

export const CustomFieldSchema = z.object({
  key: z.string().regex(/^[a-z_]+$/, "Key must contain only lowercase letters and underscores"),
  label: z.string().min(1, "Label is required"),
  defaultValue: z.string()
});

export type CustomField = z.infer<typeof CustomFieldSchema>;

/**
 * Normalize a raw placeholder to a key: trim, lowercase, replace spaces/special with underscore.
 */
export function normalizeTokenKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-./]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "placeholder";
}

const TOKEN_REGEX = /\{\{\s*([^}]+)\s*\}\}/g;

/**
 * Extracts all template tokens (normalized keys) from a template string.
 * Any {{ ... }} is a token.
 */
export function extractTokens(template: string): string[] {
  const seen = new Set<string>();
  let match;
  const re = new RegExp(TOKEN_REGEX.source, "g");
  while ((match = re.exec(template)) !== null) {
    const key = normalizeTokenKey(match[1]);
    seen.add(key);
  }
  return Array.from(seen);
}

/**
 * Returns each token with both normalized key and raw placeholder (for UI display).
 */
export function extractTokensWithRaw(template: string): { normalized: string; raw: string }[] {
  const seen = new Map<string, string>();
  let match;
  const re = new RegExp(TOKEN_REGEX.source, "g");
  while ((match = re.exec(template)) !== null) {
    const raw = match[1].trim();
    const normalized = normalizeTokenKey(raw);
    if (!seen.has(normalized)) seen.set(normalized, raw);
  }
  return Array.from(seen.entries()).map(([normalized, raw]) => ({ normalized, raw }));
}

/**
 * Validates a template: "unknown" tokens are now custom (valid). Optional: detect broken {{ without }}.
 */
export function validateTemplate(
  _template: string,
  _builtinTokens: string[],
  _customFields: CustomField[] = []
): string[] {
  return [];
}

/**
 * Builds template data by merging built-in fields with custom field defaults
 */
export function buildTemplateData(
  builtinData: Record<string, string | number>,
  customFields: CustomField[]
): Record<string, string | number> {
  const customData: Record<string, string | number> = {};
  customFields.forEach((field) => {
    customData[field.key] = field.defaultValue;
  });

  return {
    ...customData,
    ...builtinData
  };
}

/**
 * Returns tokens found in subject + body split into builtin vs custom.
 */
export function listTokens(
  subject: string,
  body: string,
  builtinKeys: string[]
): { builtin: string[]; custom: string[] } {
  const builtinSet = new Set(builtinKeys.map((k) => k.toLowerCase()));
  const all = [...extractTokens(subject), ...extractTokens(body)];
  const seen = new Set<string>();
  const builtin: string[] = [];
  const custom: string[] = [];
  for (const key of all) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (builtinSet.has(key)) builtin.push(key);
    else custom.push(key);
  }
  return { builtin, custom };
}
