-- Add custom_template_fields JSONB column to users table
alter table public.users add column if not exists custom_template_fields jsonb default '[]'::jsonb;

-- Add comment explaining the structure
comment on column public.users.custom_template_fields is 'Array of custom template field definitions: [{key: string, label: string, defaultValue: string}]';
