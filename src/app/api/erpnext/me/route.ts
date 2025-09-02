import { erpFetch } from "../_lib";

export async function GET() {
  const res = await erpFetch(`/api/method/frappe.auth.get_logged_user`, { method: "GET" });
  if (!res.ok) {
    const body = await res.text();
    return new Response(body || JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }
  const json = await res.json();
  return new Response(JSON.stringify({ user: json?.message || null }), { status: 200 });
}
