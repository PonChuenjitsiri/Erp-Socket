import { NextRequest } from "next/server";
import { erpFetch } from "@/app/api/erpnext/_lib";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const job_id = searchParams.get("job_id");
  if (!job_id) return new Response(JSON.stringify({ error: "job_id is required" }), { status: 400 });

  const res = await erpFetch(`/api/method/rbiiot.api.import_bom_api.get_bom_preview_result?job_id=${encodeURIComponent(job_id)}`);
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" } });
}
