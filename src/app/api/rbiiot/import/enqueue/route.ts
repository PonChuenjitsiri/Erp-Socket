import { erpFetch } from "@/app/api/erpnext/_lib";


export async function POST(req: Request) {
    try {
        const body = await req.text(); 
        const res = await erpFetch(`/api/method/rbiiot.api.upload_bom_api.import_bom_from_preview`, {
            method: "POST",
            body,
            headers: { "Content-Type": "application/json" },
        });
        const text = await res.text();
        return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" } });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), { status: 500 });
    }
}