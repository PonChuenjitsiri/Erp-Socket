import { NextRequest } from "next/server";
import { erpFetch } from "@/app/api/erpnext/_lib";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const preview = (form.get("preview") as string) || "1";
  if (!file || !(file instanceof Blob)) {
    return new Response(JSON.stringify({ error: "Missing file" }), { status: 400 });
  }

  const out = new FormData();
  out.set("file", file);
  out.set("preview", preview);

  const res = await erpFetch(`/api/method/rbiiot.api.import_bom_api.handle_file_preview`, {
    method: "POST",
    body: out,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}
