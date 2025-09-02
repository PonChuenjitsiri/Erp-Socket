import { cookies } from "next/headers";
import { ERP_BASE, extractSidFromSetCookie, requireEnv } from "../_lib";

function extractCsrfFromSetCookie(setCookieValues?: string[]): string | null {
  if (!setCookieValues) return null;
  for (const v of setCookieValues) {
    const m = /(?:^|;)\s*csrf_token=([^;]+)/i.exec(v);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return null;
}

export async function POST(req: Request) {
  requireEnv();
  const { usr, pwd } = await req.json().catch(() => ({}));
  if (!usr || !pwd) {
    return new Response(JSON.stringify({ error: "usr and pwd are required" }), { status: 400 });
  }

  const res = await fetch(`${ERP_BASE}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usr, pwd }),
    redirect: "manual",
  });

  const setCookies: string[] = [];
  res.headers.forEach((v, k) => { if (k.toLowerCase() === "set-cookie") setCookies.push(v); });

  const sid  = extractSidFromSetCookie(setCookies);
  const csrf = extractCsrfFromSetCookie(setCookies);

  if (!res.ok || !sid) {
    let message = "Login failed";
    try { const j = await res.json(); message = j?.message || j?._server_messages || j?.exc || message; } catch {}
    return new Response(JSON.stringify({ error: String(message) }), { status: 401 });
  }

  (await cookies()).set("erp_sid", sid,  { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 8 });
  if (csrf) {
    (await
          cookies()).set("erp_csrf", csrf, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 8 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
