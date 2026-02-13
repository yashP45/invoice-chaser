"use client";

import { useState } from "react";
import type { CustomField } from "@/lib/email/template-schema";

type CustomFieldsEditorProps = {
  initialFields: CustomField[];
};

export function CustomFieldsEditor({ initialFields }: CustomFieldsEditorProps) {
  const [fields, setFields] = useState<CustomField[]>(initialFields);

  const addField = () => {
    setFields([
      ...fields,
      {
        key: "",
        label: "",
        defaultValue: ""
      }
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    setFields(
      fields.map((field, i) => (i === index ? { ...field, ...updates } : field))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="label">Custom Template Fields</label>
        <button
          type="button"
          onClick={addField}
          className="button-secondary text-sm"
        >
          Add Field
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Define custom tokens that can be used in your email templates. Use lowercase letters and underscores only for keys.
      </p>

      {fields.length === 0 && (
        <p className="text-sm text-slate-400 italic">No custom fields defined.</p>
      )}

      {fields.map((field, index) => (
        <div key={index} className="grid gap-3 md:grid-cols-[2fr_2fr_2fr_auto] items-end">
          <div>
            <label className="label text-xs" htmlFor={`custom_key_${index}`}>
              Key (token name)
            </label>
            <input
              id={`custom_key_${index}`}
              className="input mt-1"
              placeholder="e.g., project_name"
              value={field.key}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/[^a-z_]/g, "");
                updateField(index, { key: value });
              }}
            />
            <p className="text-xs text-slate-400 mt-1">
              Use as: {`{{${field.key || "key"}}}`}
            </p>
          </div>
          <div>
            <label className="label text-xs" htmlFor={`custom_label_${index}`}>
              Label
            </label>
            <input
              id={`custom_label_${index}`}
              className="input mt-1"
              placeholder="e.g., Project Name"
              value={field.label}
              onChange={(e) => updateField(index, { label: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-xs" htmlFor={`custom_default_${index}`}>
              Default Value
            </label>
            <input
              id={`custom_default_${index}`}
              className="input mt-1"
              placeholder="Default value"
              value={field.defaultValue}
              onChange={(e) => updateField(index, { defaultValue: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={() => removeField(index)}
            className="button-danger mb-0"
          >
            Remove
          </button>
        </div>
      ))}

      <input
        type="hidden"
        name="custom_template_fields"
        value={JSON.stringify(fields)}
      />
    </div>
  );
}
