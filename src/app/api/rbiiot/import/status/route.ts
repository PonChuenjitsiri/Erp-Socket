import { NextRequest } from "next/server";
import { erpFetch as _erpFetch } from "@/app/api/erpnext/_lib";


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const job_id = searchParams.get("job_id");
    if (!job_id) return new Response(JSON.stringify({ error: "job_id is required" }), { status: 400 });


    const res = await _erpFetch(`/api/method/rbiiot.api.upload_bom_api.get_bom_import_status?job_id=${encodeURIComponent(job_id)}`);
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" } });
}