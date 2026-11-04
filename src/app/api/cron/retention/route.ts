import { NextResponse, type NextRequest } from "next/server";
import { hasBearer } from "@/lib/bearer";
import { reportError } from "@/lib/error-report";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Daily (vercel.json): erase personal data of customers not seen for RETENTION_DAYS (default 90). */
export async function GET(request: NextRequest) {
  if (!hasBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const days = Number(process.env.RETENTION_DAYS ?? 90);
  const { data, error } = await supabaseAdmin().rpc("purge_personal_data", { p_days: days });
  if (error) {
    console.error("purge_personal_data failed", error.message);
    await reportError(new Error(`purge_personal_data: ${error.message}`), { where: "cron/retention" });
    return NextResponse.json({ error: "purge_failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}
