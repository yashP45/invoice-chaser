import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "invoice_uploads";
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "File not found" }, { status: 400 });
  }

  return NextResponse.redirect(data.signedUrl);
}
